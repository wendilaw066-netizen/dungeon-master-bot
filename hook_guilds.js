const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const targetImport = `import { getDailyQuests, progressQuest } from '../utils/rpg/quests';`;
const replaceImport = `import { getDailyQuests, progressQuest } from '../utils/rpg/quests';\nimport { handleGuildCommand } from '../utils/rpg/guilds';`;
code = code.replace(targetImport, replaceImport);

const targetCmd = `    } else if (minigameCmd === '!daily' || minigameCmd === '!quest' || minigameCmd === '!quests') {`;
const replaceCmd = `    } else if (minigameCmd === '!guild') {
      const response = handleGuildCommand(args, playerIdentifier, message.author.username);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!daily' || minigameCmd === '!quest' || minigameCmd === '!quests') {`;
code = code.replace(targetCmd, replaceCmd);

fs.writeFileSync('src/events/messageCreate.ts', code, 'utf8');
console.log('Hooked guild in messageCreate');
