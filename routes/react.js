import {
  fetchMessages,
  findReport,
  sendMessage,
} from "../utils.js";
// import { 
//   ReportingForWhomOptions, 
//   ReportingReasons 
// } from "./report_forms.js";
import {
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import cors from "cors";
import express from "express";

var router = express.Router();
router.use(cors());
router.use(express.json());

// collect relevant information for users to redact their reports
router.get("/redact-reports", async function (req, res) {
  // parse get URL parameters
  let magic_token = req.query.token;
  let report = findReport(magic_token, req.reports);

  if (!report) {
    // return the error message in JSON format
    return res.status(400).json({ error: "Invalid magic token" });
  } else {
    // make sure we do not continuously request data from Discord API
    if (!report.messages) {
      let messages = await fetchMessages(
        report.channel_id,
        report.message_id,
        10
      );
      report.messages = messages;
    }
    return res.json(report);
  }
});

// initiate a report DM with the user who have redacted their reports
router.post("/report-discord", async function (req, res) {
  // parse get URL parameters
  let token = req.query.token;
  let report = findReport(token, req.reports);
  if (!report) {
    return res.status(400).json({ error: "Invalid magic token" });
  } else {
    // TODO: add code to make sure that the user is not clicking the button more than once
    if(report.reporting_status !== "not-started") {
        console.log("The report has already been started.");
        return;
    }

    let reporting_user_id = report.reporting_user_id;
    let messages = req.body.redactedMessages;
    // replace the content of each message with the redacted content to protect users' privacy
    report.messages.forEach((message, index) => {
        message.content = messages[index];
    });
    report.reporting_status = "started";
    await sendMessage(
      [`### :mailbox_with_mail: You are reporting <@${report.reported_user_id}>.`,
       "You have now successfuly redacted your reports. Start telling us more about what happened."].join("\n\n"),
      [ 
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.BUTTON,
              style: ButtonStyleTypes.PRIMARY,
              label: "Start",
              custom_id: `start-report.${token}`,
            },
          ],
        },
      ],
      reporting_user_id
    );
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
