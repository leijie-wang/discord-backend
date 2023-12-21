export const ReportingForWhomOptions = [
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


export const ReportingReasons = [
    {
        label: "Attacked with hate",
        value: "Attacked with hate",
        description: "Slurs, racial stereotypes, group harassment, unwanted violence or hateful imagery"
    },
    {
        label: "Harassed or intimidated with violence",
        value: "Harassed or intimidated with violence",
        description: "Sexual harassment, insults or name calling, posting post private info, violent threats"
    },
    {
        label: "Spammed",
        value: "Spammed",
        description: "Posting malicious links, fake engagement, repetitive messages"
    },
    {
        label: "Shown content related to or encouraged to self-harm",
        value: "Self harm",
    },
    {
        label: "Shown sensitive or disturbing content",
        value: "Shown sensitive or disturbing content",
        description: "Consensual nudity and sexual acts, non-consensual nudity, graphic violence"
    }
];

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

function getReportingForWhomLabel(value){
    if(value === "myself") return "yourself";
    return ReportingForWhomOptions.find(option => option.value === value).label.toLowerCase();
}

function getReportingReasonLabel(value){
    return ReportingReasons.find(option => option.value === value).label.toLowerCase();
}

function getReportingToWhomLabel(value){
    // find the corresponding description and make it lower case 
    return ReportingToWhomOptions.find(option => option.value === value).label.toLowerCase();
}

export function getReportingReview(report){
    let reportToWhom = getReportingToWhomLabel(report.report_to_whom);
    let reportForWhom = report.report_for_whom.map(getReportingForWhomLabel).join(", ");

    let reportReason = getReportingReasonLabel(report.report_reason);
    let reportDetails = report.report_details;
    let reviews = [
        `:mailbox_with_mail: You are reporting <@${report.reported_user_id}> to **${reportToWhom}**.`,
        `:handshake: You are reporting this user on behalf of **${reportForWhom}**.`,
        `:exclamation: You are reporting this user because they have **${reportReason}**.`,
        `:writing_hand: You also provide more details about the incident:\n\n> *${reportDetails}*.`,
    ]
    return reviews;
}
