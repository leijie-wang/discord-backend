import db from './database.js';
import { decodeMagicLink, generateMagicToken} from '../utils.js';

export async function findReport(token) {
    const { message_id, report_id } = decodeMagicLink(token);
    try {
        const report = await db('reports').where({id: report_id}).first();
        return report;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function findSimilarReports(reported_user_id, reporting_user_id){
    try {
        const reports = await db('reports')
            .where({reported_user_id: reported_user_id, reporting_user_id: reporting_user_id})
            .whereNotIn('reporting_status', ['closed', 'open'])
            .orderBy('reporting_timestamp', 'desc');
        return reports;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function mergeReports(token, merging_report_id){
    /* 
        token represents a new report with one message window, and we want to merge this new report with an existing report.
        In particular, we add this message window to the old report and delete this new report.
        Return the new token calculated from the message id and the old report id
    */
    try {
        const { message_id, report_id } = decodeMagicLink(token);
        console.log("merging report id: ", merging_report_id, "new report id: ", report_id, "message id: ", message_id);
        await db('message_windows')
            .where({report_id: report_id, message_id: message_id})
            .update({report_id: merging_report_id});

        await db('reports')
            .where({id: report_id})
            .del();
        return generateMagicToken(message_id, merging_report_id);
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function findMessageWindow(token){
    const { message_id, report_id } = decodeMagicLink(token);
    try {
        const message_window = await db('message_windows')
            .where({report_id: report_id, message_id: message_id})
            .first();
        return message_window;
    } catch (error) {
        console.error(error);
        return null;
    }

}

export async function findMessages(window_id){
    try {
        let messages = await db('messages').where({window_id: window_id});
        messages = await Promise.all(
            messages.map(async (message) => {
                let attachments = await db('attachments').where({database_message_id: message.id});
                return {
                    content: message.content,
                    message_id: message.message_id,
                    timestamp: message.timestamp,
                    attachments: attachments,
                    author: {
                        id: message.author_id,
                        username: message.author_username,
                        avatarURL: message.author_avatar_url,
                        bot: message.author_is_bot,
                    }
                }
            })
        );
        return messages;
    } catch (error) {
        console.error(error);
        return [];
    }

}

export async function addReport(reported_user_id, reporting_user_id, reporting_timestamp, message_id, channel_id){
    try{
        let result = await db('reports').insert({
            reported_user_id: reported_user_id,
            reporting_user_id: reporting_user_id,
            reporting_timestamp: reporting_timestamp,
            reporting_status: "open",
        });

        let new_report_id = result[0];
        let new_report = await db('reports').where({id: new_report_id}).first();
        console.log("New report created successfully", new_report);
        await db('message_windows').insert({
            report_id: new_report_id,
            message_id: message_id,
            channel_id: channel_id,
        });

        return new_report_id;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function addReportMessages(window_id, messages) {
        // iterate through the messages and insert them into the messages table
    messages.forEach(async (message) => {
        // console.log(message);
        try{
            let message_result = await db("messages").insert({
                window_id: window_id,
                message_id: message.message_id,
                content: message.content,
                timestamp: message.timestamp,
                author_id: message.author.id,
                author_username: message.author.username,
                author_avatar_url: message.author.avatarURL,
                author_is_bot: message.author.bot
            });

            await addMessageAttachments(message_result[0], message.attachments);
        } catch (error) {
            console.log("errored messages: ", message)
            console.error(error);
        }
    });
}

async function addMessageAttachments(database_message_id, attachments){
    attachments.forEach(async (attachment) => {
        try{
            // only add image attachments
            if(attachment.content_type.startsWith("image")){
                await db("attachments").insert({
                    database_message_id: database_message_id,
                    filename: attachment.filename,
                    url: attachment.url,
                    content_type: attachment.content_type,
                    ephemeral: attachment.ephemeral,
                });
            }
        } catch (error) {
            console.log("errored attachments: ", attachment)
            console.error(error);
        }
    });
}


export async function updateReportMessages(window_id, messages){
    /*
        params:
            window_id: the id of the message window
            messages: an array of messages with the following format:
                {
                    content: ...
                    message_id: ...
                }
    */

    messages.forEach(async (message) => {
        try{
            await db("messages")
                .where({window_id: window_id, message_id: message.message_id})
                .update({content: message.content});
            
            if(message.attachments && message.attachments.length > 0){
                let database_message = await db("messages")
                    .where({window_id: window_id, message_id: message.message_id})
                    .first(); // get the actual id of the message in the database

                await Promise.all(
                    message.attachments.map(async (attachment) => {
                        return db("attachments")
                            .where({database_message_id: database_message.id})
                            .update({is_redacted: !attachment.selected});
                    })
                );
            }
        } catch (error) {
            console.log("errored messages: ", message)
            console.error(error);
        }
    });

    try {
        await db("message_windows")
            .where({id: window_id})
            .update({is_redacted: true});
    } catch (error) {
        console.error(error);
    }
}

export async function updateReportForms(token, field_name, new_value) {
    // update the report form with the new value for the field
    try {
        const { message_id, report_id } = decodeMagicLink(token);
        const update_object = {};
        update_object[field_name] = new_value;

        await db('reports')
            .where({ id: report_id })
            .update(update_object);

        console.log(`Updated report ${report_id} with "${field_name}" = "${new_value}"`);
    } catch (error) {
        console.error(error);
        // Handle the error appropriately
    }
}

export async function findReportsByUserId(user_id, number){
    try {
        const reports = await db('reports')
            .where({reporting_user_id: user_id})
            .orderBy('reporting_timestamp', 'desc')
            .limit(number);
        return reports;
    } catch (error) {
        console.error(error);
        return [];
    }
}