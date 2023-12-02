import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';

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
  // return original response
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


export async function fetchMessages(channelId, messageId, limit) {
  let endpoint = `channels/${channelId}/messages`;
  let options = { around: messageId, limit: limit };

  let messages = await DiscordGetRequest(endpoint, options);

  // clear message information from the returned JSON and map in reverse order
  messages = messages.reverse().map(message => {
    return {
      id: message.id,
      content: message.content,
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

export function generateMagicLink(messageId, userId, timestamp){
  // generate a magic link for the user to click on
  const uniqueString = `${messageId}#${userId}#${timestamp}#${process.env.DISCORD_TOKEN}`;
  const encodedString = Buffer.from(uniqueString).toString('base64');
  const magicLink = `${process.env.BASE_URL}?token=${encodedString}`;

  console.log("magic link generated:", magicLink);
  return magicLink;
}

// functions that decode the magic link
export function decodeMagicLink(token){
  const decodedString = Buffer.from(token, 'base64').toString('ascii');
  const [message_id, user_id, timestamp, token2] = decodedString.split('#');
  console.log("token2:", token2);
  if (token2 !== process.env.DISCORD_TOKEN) {
    console.log("token2 does not match");
    return {
      messageId: null,
      userId: null,
      timestamp: null
    }
  } else {
    return {
      message_id: message_id,
      user_id: user_id,
      timestamp: timestamp
    }
  }
}
