import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from 'discord-interactions';
import {
    findReport,
} from '../database/queries.js';

export async function getStartReportMessage(token) {
    let report = await findReport(token);

    let message = [
        `### :mailbox_with_mail: You are reporting <@${report.reported_user_id}>.`,
        "You have now successfuly redacted your reports. Start telling us more about what happened."
    ].join("\n\n");

    let action_component = [{
        type: MessageComponentTypes.ACTION_ROW,
        components: [
            {
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: "Start",
                custom_id: `start-report.${token}`,
            },
        ],
    }];

    return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            components: action_component,
        }
    };
}

const ReportingForWhomOptions = [
    {
        label: "Myself",
        value: "Myself"
    },
    {
        label: "Someone else", 
        value: "Someone else"
    },
    {
        label: "A Specific Group of People", 
        value: "A specific group of people",
        description: "This message is directed at or mentions a group of people--like racial or religious people"
    },
    {
        label: "Everyone on the server",
        value: "Everyone on the server",
        description: "This message affects everyone on the server"
    }
];

export function getReportingForWhomMessages(token){
    return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "### Reporting Process 1/6. \n\nWho is this report for?",
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
        }
    };
}

const ReportingReasons = [
    {
        label: "Disrespectful or offensive",
        value: "Disrespectful or offensive",
        // description: "Slurs, racial stereotypes, group harassment, unwanted violence or hateful imagery"
    },
    {
        label: "Exposing private information",
        value: "Exposing private information",
        // description: "Sexual harassment, insults or name calling, posting post private info, violent threats"
    },
    {
        label: "Harassment or abuse",
        value: "Harassment or abuse",
        // description: "Posting malicious links, fake engagement, repetitive messages"
    },
    {
        label: "Hate speech against a protected category",
        value: "Hate speech against a protected category",
    },
    {
        label: "Suicide or self-harm",
        value: "Suicide or self-harm",
    },
    {
        label: "Pretending to be someone",
        value: "Pretending to be someone",
    },
    {
        label: "Something else",
        value: "Something else",
    }
];

export function getReportingReasonMessages(token){
    return {
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
    }
}

export const ReportingToWhomOptions = [
    {  
        label: "The server moderators",
        value: "Server moderators"
    },
    {
        label: "The platform moderators",
        value: "Platform moderators"
    }
];

export function getReportingToWhomMessages(token){
    return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "### Reporting Process 2/6.\n\nWho should this report be sent to?",
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
    }
}

export const ReportingOutComeOptions = [
    {  
        label: "Account Suspension",
        value: "Account Suspension"
    },
    {
        label: "Content Removal",
        value: "Content Removal,"
    },
    {
        label: "Further Investigation",
        value: "Further Investigation"
    }
];

export function getReportingOutComeMessages(token){
    return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "### Reporting Process 6/6.\n\nWhat outcome are you hoping for from this report?",
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.STRING_SELECT,
                    custom_id: `report-outcome.${token}`,
                    options: ReportingOutComeOptions,
                    max_values: 1,
                    placeholder: "Select the outcome you hope for this report...",
                }],
            }],
        },
    }
}

export function getReportingDetailsMessages(token){
    return {
        type: InteractionResponseType.MODAL,
        data: {
            title: "### Reporting Process 4/6:\n\nProvide more details if you want (optional)",
            custom_id: `report-details.${token}`,
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.INPUT_TEXT,
                    custom_id: `report-details-inner.${token}`,
                    label: "Details",
                    style: 2, // 2 for multi-line input, and 1 for single-line input
                    max_length: 1000, 
                    placeholder: "Provide more details here",
                    required : false,
                }],
            }],
        },
    };
}

function getReportingForWhomLabel(value){
    if(value === "myself") return "yourself";
    return ReportingForWhomOptions.find(option => option.value === value).label.toLowerCase();
}

export function getReportingReasonLabel(value){
    return ReportingReasons.find(option => option.value === value).label.toLowerCase();
}

function getReportingToWhomLabel(value){
    // find the corresponding description and make it lower case 
    return ReportingToWhomOptions.find(option => option.value === value).label.toLowerCase();
}

export function getReportingReview(report){
    console.log(report);
    let reportToWhom = getReportingToWhomLabel(report.report_to_whom);
    let reportForWhom = report.report_for_whom.split(",").map(getReportingForWhomLabel).join(", ");

    let reportReason = getReportingReasonLabel(report.report_reason);
    let reportDetails = report.report_details;
    let reviews = [
        `:mailbox_with_mail: You are reporting <@${report.reported_user_id}> to **${reportToWhom}**.`,
        `:handshake: You are reporting this user on behalf of **${reportForWhom}**.`,
        `:exclamation: You are reporting this user because they have **${reportReason}**.`,
        `:writing_hand: You also provide more details about the incident:\n> *${reportDetails}*.`,
    ]
    return reviews;
}

export async function getReportingCompleteMessage(token){
    let report = await findReport(token);
    let review = getReportingReview(report).join("\n\n");
    let content = `### Review your final report.\n\n${review}\n### Thank you for your report. We will review it and take appropriate action.`;
    return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: content,
        },    
    };
}

export async function getReportingReviewMessage(token){
    let report = await findReport(token);
    let review = getReportingReview(report).join("\n\n");
    let content = `### :clipboard: Review your report before submitting\n\n${review}\n### Please confirm that you want to submit this report.`;
    // console.log("review:", content);
    return {
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
    };
}

export function getReportingContextMessages(token){
    return {
        type: InteractionResponseType.MODAL,
        data: {
            title: "### Reporting Process 4/6:\n\nProvide more context if you want (optional)",
            custom_id: `report-context.${token}`,
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.INPUT_TEXT,
                    custom_id: `report-context-inner.${token}`,
                    label: "Context",
                    style: 2, // 2 for multi-line input, and 1 for single-line input
                    max_length: 1000, 
                    placeholder: "Provide more context here",
                    required : false,
                }],
            }],
        },
    };
}

// define the order of the reporting forms
export const ReportingFormsOrder = ["merge-reports", "start-report", "report-for-whom", "report-to-whom", "report-reason", "report-context", "report-details", "report-outcome", "submit-report", "final-review"];
// define the messages for each step
export const ReportingMessages = {
    "start-report": getStartReportMessage,
    "report-for-whom": getReportingForWhomMessages,
    "report-reason": getReportingReasonMessages,
    "report-to-whom": getReportingToWhomMessages,
    "report-outcome": getReportingOutComeMessages,
    "report-details": getReportingDetailsMessages,
    "report-context": getReportingContextMessages,
    "submit-report": getReportingReviewMessage,
    "final-review": getReportingCompleteMessage,
}