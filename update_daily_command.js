const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const targetImport = `import {`;
const replaceImport = `import { getDailyQuests } from '../utils/rpg/quests';\nimport {`;
code = code.replace(targetImport, replaceImport);

const targetCmd = `    } else if (minigameCmd === '!tutorial') {`;
const replaceCmd = `    } else if (minigameCmd === '!daily' || minigameCmd === '!quest' || minigameCmd === '!quests') {
      const response = getDailyQuests(playerIdentifier);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!tutorial') {`;
code = code.replace(targetCmd, replaceCmd);

fs.writeFileSync('src/events/messageCreate.ts', code, 'utf8');
