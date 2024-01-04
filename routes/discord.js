import express from 'express';
import db from '../database/database.js';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from 'discord-interactions';
import { 
    VerifyDiscordRequest,
    getRandomEmoji, 
    generateMagicLink,
    deleteInteractionMessage,
    convertToDateTime,
    sendMessage
} from '../utils.js';
import {
    ReportingFormsOrder,
    ReportingMessages,
    getReportingReview
} from './report_forms.js';
import {
    addReport, updateReportForms, mergeReports, findReport, findReportsByUserId
} from '../database/queries.js';

var router = express.Router();
// Parse request body and verifies incoming requests using discord-interactions package
router.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

const reports = []

// Interactions endpoint URL where Discord will send HTTP requests
router.post('/interactions', async function (req, res) {
    // Interaction type and data
    const { type, id, data } = req.body;
  
    // Handle verification requests
    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }
  
    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
        // "test" command
        if (data.name === "test") {
            // Send a message into the channel where command was triggered from
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "hello world " + getRandomEmoji(),
                },
            });
        }

        // privacy reporting command, when the user selects a message to report
        if (data.name === "PrivacyReporting") {
            let messages_object = data.resolved.messages;
            let message_id = Object.keys(messages_object)[0];
            let channel_id = messages_object[message_id].channel_id;
            let reported_user_id = messages_object[message_id].author.id;
            let reporting_user_id = req.body.member.user.id;
            let reporting_timestamp = Math.floor(Date.now() / 1000);
            
            let new_report_id = await addReport(reported_user_id, reporting_user_id, reporting_timestamp, message_id, channel_id);
            if (!new_report_id) {
                return res.status(400).json({ error: "Failed to create a new report" });
            } else {
                let magic_link = generateMagicLink(message_id, new_report_id);
                
                return res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "Redact your reports using our web portal",
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.BUTTON,
                                url: magic_link,
                                label: "Redact Reports",
                                style: ButtonStyleTypes.LINK,
                            }],
                        }],
                    },
                });
            }
        }

        // when the user wants to review their reports
        if (data.name === "myreports"){
            const {channel, user} = req.body;
            if(channel.type !== 1){
                // if this command is not invoked in a DM
                return res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "To protect your privacy, this command can only be used in a DM with the bot.",
                    },
                });
            }

            let number = data.options ? data.options[0].value : 5;
            let reports = await findReportsByUserId(user.id, number);
            if(reports.length === 0){
                return res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "You haven't submitted any reports yet.",
                    },
                });
            } else {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "Here are your latest reports",
                    },
                });

                await Promise.all(
                    reports.map(async (report, index) => {
                        let review = getReportingReview(report).join("\n");
                        let content = `### ${index + 1}. Report on ${convertToDateTime(report.reporting_timestamp)}\nstatus: **${report.reporting_status}**\n\n${review}\n`;
                        let components = [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.BUTTON,
                                custom_id: `review-reports.${report.id}`,
                                label: "See Reported Messages",
                                style: ButtonStyleTypes.PRIMARY,
                            }],
                        }];
                        await sendMessage(content, components, user.id);
                    })
                );
            }
        }
    }
    
    // Handle component interactions
    if (type === InteractionType.MESSAGE_COMPONENT || type === InteractionType.MODAL_SUBMIT) {
        // modal submission is handled in a separate endpoint than the message component
        // custom_id set in payload when sending message component
        const component_id = data.custom_id;
        let step = component_id.split(".")[0];
        if(!ReportingFormsOrder.includes(step)) return res.status(400).json({ error: "Invalid step" });
        
        let next_step = ReportingFormsOrder[ReportingFormsOrder.indexOf(step) + 1];
        let token = component_id.split(".")[1];
        // document the user's response in the database
        switch (step) {
            case "merge-reports":
                let merging_report_id = data.values[0];
                if(merging_report_id !== "no") {
                    // we should update the token to the report that is merged with so that we can generate the review
                    token = await mergeReports(token, merging_report_id); 
                    next_step = "submit-report"
                }
                break;
            case "start-report":
                break;
            case "report-for-whom":
                await updateReportForms(token, "report_for_whom", data.values.join(","));
                break;
            case "report-reason":
                await updateReportForms(token, "report_reason", data.values[0]);
                break;
            case "report-to-whom":
                await updateReportForms(token, "report_to_whom", data.values[0]);
                break;
            case "report-details":
                await updateReportForms(token, "report_details", data.components[0].components[0].value);
                break;
            case "submit-report":
                await updateReportForms(token, "reporting_status", "submitted");
                break;
            default:
                break;
        }

        // send out response in a message component
        // console.log(`from ${step} to ${next_step}`);
        try {
            res.send(await ReportingMessages[next_step](token));
            deleteInteractionMessage(req.body.token, req.body.message);
        } catch (err) {
            console.error(err);
        }
    }
});

 export default router;