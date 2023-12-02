import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
  DiscordRequest, 
  DiscordGetRequest,
  fetchMessages,
  generateMagicLink,
  decodeMagicLink
} from './utils.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));
app.use(cors());

const reports = []
/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {

    // "test" command
    if (data.name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }

    // privacy reporting command
    if (data.name === 'PrivacyReporting') {
      console.log('PrivacyReporting interactions endpoint hit');
      // get the channel id where the reported message is
      let messages_object = data.resolved.messages
      let message_id = Object.keys(messages_object)[0]
      let channel_id = messages_object[message_id].channel_id
      let reported_user_id = messages_object[message_id].author.id
      let reporting_user_id = req.body.member.user.id
      let timestamp = new Date().toISOString();
      // use discord api to get 10 messages around the reported messsage /channels/{channel.id}/messages
      // let messages = await fetchMessages(channel_id, message_id, 10)
      
      // sotre information in the reports array
      reports.push({
        message_id: message_id,
        channel_id: channel_id,
        reported_user_id: reported_user_id,
        reporting_user_id: reporting_user_id,
        reporting_timestamp: timestamp
      })

      let magic_link = generateMagicLink(message_id, reporting_user_id, timestamp)

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Redact your reports using our web portal',
          // Buttons are inside of action rows
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  // Value for your app to identify the button
                  url: magic_link,
                  label: 'Redact Reports',
                  style: ButtonStyleTypes.LINK,
                },
              ],
            },
          ],
        },
      });
    }
  }

});


app.get('/redact-reports', async function (req, res) {
  // parse get URL parameters
  let magic_token = req.query.token;
  console.log(magic_token)

  let {message_id, user_id, timestamp} = decodeMagicLink(magic_token)
  // search for the report in the reports array to validate the existence of reports
  console.log("message_id:", message_id)
  let report = reports.find(report => report.message_id === message_id && report.reporting_user_id === user_id && report.reporting_timestamp === timestamp)
  
  if (!report) {
    // return the error message in JSON format
    return res.status(400).json({ error: 'Invalid magic token' });
  } else {
    if(!report.messages){
      // get the channel id where the reported message is
      let channel_id = report.channel_id
      let messages = await fetchMessages(channel_id, message_id, 10)
      // get the unique users from the messages
      // let user_avatars = {}
      // messages.forEach(message => {
      //   user_avatars[message.author.id] = fetchAvatar(message.author.id, message.author.avatar);
      // });
      // report.user_avatars = user_avatars

      report.messages = messages
      
    } 
    
    return res.json(report);
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
