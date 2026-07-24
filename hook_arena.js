const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const targetImport = `import { handleGuildCommand } from '../utils/rpg/guilds';`;
const replaceImport = `import { handleGuildCommand } from '../utils/rpg/guilds';\nimport { handleArena, handleArenaTop } from '../utils/rpg/arena';`;
code = code.replace(targetImport, replaceImport);

const targetCmd = `    } else if (minigameCmd === '!guild') {`;
const replaceCmd = `    } else if (minigameCmd === '!arena') {
      if (args[0] === 'top') {
        const response = handleArenaTop();
        message.reply(response).catch(()=>{});
        return;
      }
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        message.reply('❌ Gunakan: \`!arena @user\` untuk menantang orang atau \`!arena top\` untuk melihat leaderboard.').catch(()=>{});
        return;
      }
      const response = handleArena(playerIdentifier, targetUser.id, message.author.username, targetUser.username);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!guild') {`;
code = code.replace(targetCmd, replaceCmd);

fs.writeFileSync('src/events/messageCreate.ts', code, 'utf8');
console.log('Hooked arena in messageCreate');
