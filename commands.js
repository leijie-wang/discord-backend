import 'dotenv/config';

import { capitalize, InstallGlobalCommands } from './utils.js';


const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command customized',
  type: 1,
  dm_permission: true,
};

const PRIVACY_REPORTING_COMMAND = {
  name: 'PrivacyReporting',
  type: 3,
};

const REPORTING_DASHBOARD_COMMAND = {
    name: "myreports",
    description: "Review your latest N reports",
    type: 1,
    dm_permission: true,
    options: [{
        type: 4, // integers,
        name: "number",
        description: "Number of reports to show (default 5)",
        required: false,
        min_value: 1,
        max_value: 10,
    }]
};

const ALL_COMMANDS = [TEST_COMMAND, PRIVACY_REPORTING_COMMAND, REPORTING_DASHBOARD_COMMAND];

console.log(ALL_COMMANDS);
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);