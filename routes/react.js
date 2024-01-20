import {
    fetchMessages,
    sendMessage,
    convertToDateTime,
    checkFrontendValidity,
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
    findMessageWindowsByReport,
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
    let message_window = await findMessageWindow(magic_token);

    let error_message = checkFrontendValidity(report, message_window);
    if(error_message !== null) return res.status(400).json({ error: error_message });
    
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

// help retrieve additional messages in a window
router.get("/expand-window", async function (req, res) {
    let magic_token = req.query.token;
    let message_id = req.query.message_id;
    let direction = req.query.direction;
    // make sure direction is either "before" or "after"
    if(direction !== "before" && direction !== "after") return res.status(400).json({ error: "Invalid direction" });

    let report = await findReport(magic_token);
    let message_window = await findMessageWindow(magic_token);

    let error_message = checkFrontendValidity(report, message_window);
    if(error_message !== null) return res.status(400).json({ error: error_message });

    let expanded_messages = await fetchMessages(message_window.channel_id, message_id, 5, direction);
    await addReportMessages(message_window.id, expanded_messages);

    return res.json({expanded_messages: expanded_messages});
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

/* 
    Let the reporting user review their redacted message windows of a given report
    TODO: with the witnesses as potential reviewers
*/
router.get("/review-report", async function (req, res) {
    let token = req.query.token;
    let report = await findReport(token);
    if(!report) return res.status(400).json({ error: "Invalid magic token" });

    // return all message windows of this report
    const message_windows = await findMessageWindowsByReport(report.id);
    if(message_windows.length === 0) return res.status(400).json({ error: "No message windows found" });
    return res.json({
        reporting_user_id: report.reporting_user_id,
        reported_user_id: report.reported_user_id,
        reporting_timestamp: report.reporting_timestamp,
        message_windows: message_windows
    });
});

/* 
    Send moderators all reports
    Todo: future should only send identifier information at the step; instead of sending all information
    Todo: there should also be some authentication process to make sure that only moderators can access this information
*/
router.get("/moderate-reports", async function (req, res) {
    console.log(req.reports);
    return res.json(req.reports.filter(report => report.reporting_status === "submitted"));
});


export default router;
