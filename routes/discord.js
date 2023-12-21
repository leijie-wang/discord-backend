import express from 'express';
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
    findReport,
    sendMessage,
    deleteInteractionMessage,
} from '../utils.js';
import {
    ReportingForWhomOptions,
    ReportingReasons,
    ReportingToWhomOptions,
    getReportingReview
} from './report_forms.js';

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

        // privacy reporting command
        if (data.name === "PrivacyReporting") {
            console.log("PrivacyReporting interactions endpoint hit");
            let messages_object = data.resolved.messages;
            let message_id = Object.keys(messages_object)[0];
            let channel_id = messages_object[message_id].channel_id;
            let reported_user_id = messages_object[message_id].author.id;
            let reporting_user_id = req.body.member.user.id;
            let timestamp = new Date().toISOString();

            // store information in the reports array; should use database in production later
            req.reports.push({
                message_id: message_id,
                channel_id: channel_id,
                reported_user_id: reported_user_id,
                reporting_user_id: reporting_user_id,
                reporting_timestamp: timestamp,
                report_for_whom: null,
                report_to_whom: null,
                report_reason: null,
                report_details: null,
                reporting_status: "not-started",
            });

            let magic_link = generateMagicLink(
                message_id,
                reporting_user_id,
                timestamp
            );

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
    
    // Handle component interactions
    if (type === InteractionType.MESSAGE_COMPONENT) {
        // custom_id set in payload when sending message component
        const component_id = data.custom_id;

        if (component_id.startsWith("start-report")) {
            let token = component_id.split(".")[1];
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "### Reporting Process 1/4. \n\nWho is this report for?",
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.STRING_SELECT,
                                custom_id: `report-for-whom.${token}`,
                                options: ReportingForWhomOptions,
                                max_values: ReportingForWhomOptions.length, 
                                placeholder: "Select all that apply",
                            }],
                        }],
                    },
                });
                deleteInteractionMessage(req.body.token, req.body.message);
            } catch (err) {
                console.error(err);
            }
        } else if (component_id.startsWith("report-for-whom")) {
            let token = component_id.split(".")[1];
            let report = findReport(token, req.reports);
            if (!report) return res.status(400).json({ error: "Invalid magic token" });
            let selected_option = data.values;
            console.log("selected reporting for whom options:", selected_option);
            report.report_for_whom = selected_option;
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "### Reporting Process 2/4.\n\nThey are being ...",
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.STRING_SELECT,
                                custom_id: `report-reason.${token}`,
                                options: ReportingReasons,
                                max_values: 1,
                                placeholder: "Select the best match",
                            }],
                        }],
                    },
                });
                deleteInteractionMessage(req.body.token, req.body.message);
            } catch (err) {
                console.error(err);
            }

        } else if (component_id.startsWith("report-reason")) {
            let token = component_id.split(".")[1];
            let report = findReport(token, req.reports);
            if (!report) return res.status(400).json({ error: "Invalid magic token" });
            let selected_option = data.values;
            console.log("selected reporting reason options:", selected_option);
            report.report_reason = selected_option[0];
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "### Reporting Process 3/4.\n\nWho should this report be sent to?",
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.STRING_SELECT,
                                custom_id: `report-to-whom.${token}`,
                                options: ReportingToWhomOptions,
                                max_values: 1,
                                placeholder: "Select the group of moderators you want to report to",
                            }],
                        }],
                    },
                });
                deleteInteractionMessage(req.body.token, req.body.message);
            } catch (err) {
                console.error(err);
            }
           
        } else if (component_id.startsWith("report-to-whom")){
            let token = component_id.split(".")[1];
            let report = findReport(token, req.reports);
            if (!report) return res.status(400).json({ error: "Invalid magic token" });
            let selected_option = data.values;
            console.log("selected reporting to whom options:", selected_option);
            report.report_to_whom = selected_option[0];
            try {
                res.send({
                    type: InteractionResponseType.MODAL,
                    data: {
                        title: "Provide more details if you want (optional)",
                        custom_id: `report-details-modal.${token}`,
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.INPUT_TEXT,
                                custom_id: `report-details.${token}`,
                                label: "Details",
                                style: 2, // 2 for multi-line input, and 1 for single-line input
                                max_length: 1000, 
                                placeholder: "Provide more details here",
                                required : false,
                            }],
                        }],
                    },
                });
                deleteInteractionMessage(req.body.token, req.body.message);
            } catch (err) {
                console.error(err);
            }
        } else if (component_id.startsWith("submit-report")) {
            let token = component_id.split(".")[1];
            let report = findReport(token, req.reports);
            if (!report) return res.status(400).json({ error: "Invalid magic token" });
            report.reporting_status = "submitted";
            let review = getReportingReview(report).join("\n\n");
            let content = `### Review your final report.\n\n${review}\n### Thank you for your report. We will review it and take appropriate action.`;
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: content,
                    },
                });
                deleteInteractionMessage(req.body.token, req.body.message);
            } catch (err) {
                console.error(err);
            }
        }
    }

    // modal submission is handled in a separate endpoint than the message component
    if(type == InteractionType.MODAL_SUBMIT){
        // custom_id set in payload when sending message component
        const custom_id = data.custom_id;
        if (custom_id.startsWith("report-details-modal")) {
            let token = custom_id.split(".")[1];
            let report = findReport(token, req.reports);
            if (!report) return res.status(400).json({ error: "Invalid magic token" });
            let report_details = data.components[0].components[0].value;
            report.report_details = report_details;
            let review = getReportingReview(report).join("\n\n");
            let content = `### :clipboard: Review your report before submitting\n\n${review}\n### Please confirm that you want to submit this report.`;
            console.log("review:", content);
            try {
                
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: content,
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.BUTTON,
                                custom_id: `submit-report.${token}`,
                                label: "Submit Report",
                                style: ButtonStyleTypes.PRIMARY,
                            }],
                        }],
                    },
                });
            } catch (err) {
                console.error(err);
            }
        }
    }
});

 export default router;