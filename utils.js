import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';
import {findReport} from './database/queries.js';

export function VerifyDiscordRequest(clientKey) {
    return function (req, res, buf, encoding) {
        const signature = req.get('X-Signature-Ed25519');
        const timestamp = req.get('X-Signature-Timestamp');
        // console.log(signature, timestamp);
        const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
        if (!isValidRequest) {
            res.status(401).send('Bad request signature');
            throw new Error('Bad request signature');
        }
    };
}

export async function DiscordRequest(endpoint, options) {
    // append endpoint to root API URL
    const url = 'https://discord.com/api/v10/' + endpoint;
    // Stringify payloads
    if (options.body) options.body = JSON.stringify(options.body);
    // Use node-fetch to make requests
    const res = await fetch(url, {
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
        },
        ...options
    });
    // throw API errors
    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res;
}

export async function DiscordGetRequest(endpoint, options) {
    // append endpoint and options to root API URL
    let url = 'https://discord.com/api/v10/' + endpoint;
    if (options) {
        const queryString = Object.entries(options)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        url += `?${queryString}`;
    }
    // Use node-fetch to make requests
    const res = await fetch(url, {
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
        }
    });

    const data = await res.json();
    
    // throw API errors
    if (!res.ok) {
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }
    // return original response
    return data;
}

export async function InstallGlobalCommands(appId, commands) {
    // API endpoint to overwrite global commands
    const endpoint = `applications/${appId}/commands`;

    try {
        // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
        await DiscordRequest(endpoint, { method: 'PUT', body: commands });
    } catch (err) {
        console.error(err);
    }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
    const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
    return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


export async function fetchMessages(channel_id, message_id, limit) {
    let endpoint = `channels/${channel_id}/messages`;
    let options = { around: message_id, limit: limit };

    let messages = await DiscordGetRequest(endpoint, options);

    // clear message information from the returned JSON and map in reverse order
    messages = messages.reverse().map(message => {
        // console.log("attachments: ", message.attachments);
        return {
            message_id: message.id,
            content: message.content,
            attachments: message.attachments.map(
                attachment => {
                    return {
                        url: attachment.url,
                        filename: attachment.filename,
                        content_type: attachment.content_type,
                        ephemeral: attachment.ephemeral || false
                    }
                }
            ),
            timestamp: message.timestamp,
            edited_timestamp: message.edited_timestamp,
            author:{
                id: message.author.id,
                username: message.author.username,
                avatarURL: message.author.avatar ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png` : null,
                bot: message.author.bot
            },
        }
    });
    return messages;
}

// export async function fetchAvatar(userId, avatarHash) {
//   if (avatarHash === null) {
//     return null;
//   } else {
//     let endpoint = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
//     let response = await fetch(endpoint);

//     let imageBuffer = Buffer.from(await response.arrayBuffer()).toString('base64');
//     // console.log("avatar:", imageBuffer);
//     return imageBuffer;
//   }
  
// }

export function generateMagicToken(message_id, report_id){
    const uniqueString = `${message_id}#${report_id}#${process.env.MAGIC_KEY}`;
    const encodedString = Buffer.from(uniqueString).toString('base64');
    // const encodedString = crypto.createHash('sha1').update(uniqueString).digest('hex');
    return encodedString;

};

export async function checkExpiredToken(report){
    let reporting_timestamp = report.reporting_timestamp;
    let current_timestamp = Math.floor(Date.now() / 1000);
    let time_difference = current_timestamp - reporting_timestamp;
    // if less than 15 minutes, then the token is still valid
    if(time_difference < 15 * 60){
        return false;
    } else {
        return true;
    }

}
export function generateMagicLink(message_id, report_id){
    // generate a magic link for the user to click on
    const encodedString = generateMagicToken(message_id, report_id);
    const magicLink = `${process.env.BASE_URL}?token=${encodedString}`;
    console.log("magic link generated:", magicLink);
    return magicLink;
}

// functions that decode the magic link
export function decodeMagicLink(token){
    const decodedString = Buffer.from(token, 'base64').toString('ascii');
    const [message_id, report_id, token2] = decodedString.split('#');
    // console.log("decoded result:", message_id, report_id, token2)
    if (token2 !== process.env.MAGIC_KEY) {
        console.log("token2 does not match");
        return {
            message_id: null,
            report_id: null
        }
    } else {
        return {
            message_id: message_id,
            report_id: report_id
        }
    }
}

export async function sendMessage(content, components, userId = null, channelId = null) {
  
    // prepare the DM channel object
    if(channelId === null && userId === null){
        console.log("channelId and userId cannot both be null");
        return null;
    } else if(channelId == null){
        try {
            let channel_response = await DiscordRequest(`/users/@me/channels`, {
                    method: "POST",
                    body: {recipient_id: userId},
                });
            let channel = await channel_response.json();
            channelId = channel.id;
        } catch(err){
            console.error(err);
            return null;
        }
    }

    // send messages to the given channel object
    try {
        let messageResponse = await DiscordRequest(
            `/channels/${channelId}/messages`,
            {
                method: "POST",
                body: {
                    content: content,
                    components: components,
                },
            }
        );
        let response = await messageResponse.json();
        // console.log(response);
    } catch (err) {
        console.error(err);
        return null;
    }

    return channelId;
}

export function deleteInteractionMessage(token, message){
    // if the previous message is a modal input, then there is not a message to delete
    if(!message) return;
    let messageId = message.id;
    // console.log("deleting message:", message.content);
    let endpoint = `webhooks/${process.env.APP_ID}/${token}/messages/${messageId}`;
    try {
        DiscordRequest(endpoint, { method: 'DELETE' });
    } catch (err) {
        console.error(err);
    }
}

export function convertToDateTime(timestamp){
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const formattedDate = new Date(timestamp * 1000).toLocaleString([], dateOptions);

    return formattedDate;
}