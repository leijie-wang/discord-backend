import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
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

const ALL_COMMANDS = [TEST_COMMAND, PRIVACY_REPORTING_COMMAND];

console.log(ALL_COMMANDS);
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);