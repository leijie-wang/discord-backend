import {
    fetchMessages,
    sendMessage,
    convertToDateTime,
    checkExpiredToken
} from "../utils.js";
import {
    MessageComponentTypes,
    ButtonStyleTypes,
} from "discord-interactions";
import cors from "cors";
import express from "express";
import { 
    findReport, 
    findMessageWindow,
    findMessages,
    addReportMessages,
    updateReportMessages,
    findSimilarReports,
} from "../database/queries.js";
import { getReportingReasonLabel, getStartReportMessage} from "./report_forms.js";

var router = express.Router();
router.use(cors());
router.use(express.json());

// collect relevant information for users to redact their reports
router.get("/redact-reports", async function (req, res) {
    // parse get URL parameters
    let magic_token = req.query.token;
    let report = await findReport(magic_token);
    if(!report) return res.status(400).json({ error: "Invalid magic token for retrieving reports" });

    let message_window = await findMessageWindow(magic_token);
    if (!message_window) return res.status(400).json({ error: "Invalid magic token for redacting message windows" });
    // the user might have already clicked the url button, so we need to check if the message window has already been redacted
    if(message_window.is_redacted) return res.status(400).json({ error: "The message window has already been redacted" });

    if(checkExpiredToken(report) === true) {
        return res.status(400).json({ error: "The magic token has expired after 15 minutes" });
    }
    
    // make sure we do not continuously request data from Discord API by looking releveant messages in the database
    let messages = await findMessages(message_window.id);
    if(messages.length === 0) {
        messages = await fetchMessages(message_window.channel_id, message_window.message_id, 10);
        await addReportMessages(message_window.id, messages);
    }

    message_window.messages = messages;
    report.message_window = message_window;
    // report.message_window.messages.forEach(
    //     (message) => {
    //         console.log(message);
    //     }
    // )
    return res.json(report);
    
});

// initiate a report DM with the user who have redacted their reports
router.post("/report-discord", async function (req, res) {
    // parse get URL parameters
    let token = req.query.token;
    let report = await findReport(token);
    let message_window = await findMessageWindow(token);
    if (!report || !message_window) {
        return res.status(400).json({ error: "Invalid magic token" });
    } else {
        // the user might clicked the url button multiple times, and go through the reporting process using one of the links; we need to check if the report has already been closed
        if(report.reporting_status === "closed") return res.status(400).json({ error: "The report has already been closed" });
        // the user might have already clicked the url button, so we need to check if the message window has already been redacted
        if(message_window.is_redacted) return res.status(400).json({ error: "The message window has already been redacted" });
        
        let messages = req.body.redactedMessages;
        // we update the is_redacted status of the messge window in the database as well 
        updateReportMessages(message_window.id, messages); 

        let similar_reports = await findSimilarReports(report.reported_user_id, report.reporting_user_id);
        if(similar_reports.length > 0){
            let message = [
                    `### :mailbox_with_mail: You are reporting <@${report.reported_user_id}>.`,
                    "You have now successfuly redacted your reports. We have found that you have pending reports for this user before, do you want to merge them into one report?",
                ].join("\n\n");
            
            let select_options = similar_reports.map(
                    (similar_report) => {
                        return {
                            label: `Report on ${convertToDateTime(similar_report.reporting_timestamp)}`,
                            description: `for ${getReportingReasonLabel(similar_report.report_reason)}`,
                            value: similar_report.id,
                        }}
                );

            select_options.unshift({label: "No, I want to start a new report", value: "no",});

            let action_component = [{
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [{
                        type: MessageComponentTypes.STRING_SELECT,
                        custom_id: `merge-reports.${token}`,
                        options:  select_options,
                        max_values: 1, 
                        placeholder: "Select the report you want to merge with",
                    }],
                }]
            await sendMessage(message, action_component, report.reporting_user_id);

        } else {
            let message = await getStartReportMessage(token);
            await sendMessage(message.data.content, message.data.components, report.reporting_user_id);
        }
    }
});

// send moderators all reports
// Todo: future should only send identifier information at the step; instead of sending all information
// Todo: there should also be some authentication process to make sure that only moderators can access this information
router.get("/review-reports", async function (req, res) {
    console.log("review-reports");
    console.log(req.reports);
    return res.json(req.reports.filter(report => report.reporting_status === "submitted"));
});

export default router;
