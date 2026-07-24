const fs = require('fs');

// 1. Update minigame.ts interface
let mgCode = fs.readFileSync('src/utils/minigame.ts', 'utf8');
const targetMG = `  activeTitle?: string;`;
const replaceMG = `  activeTitle?: string;
  activeArenaBattle?: any;
  pendingArenaChallenge?: string;`;
mgCode = mgCode.replace(targetMG, replaceMG);
fs.writeFileSync('src/utils/minigame.ts', mgCode, 'utf8');

// 2. Update messageCreate.ts
let mcCode = fs.readFileSync('src/events/messageCreate.ts', 'utf8');
const targetImportMC = `import { handleArena, handleArenaTop } from '../utils/rpg/arena';`;
const replaceImportMC = `import { handleArena, handleArenaTop, handleArenaAccept } from '../utils/rpg/arena';`;
mcCode = mcCode.replace(targetImportMC, replaceImportMC);

const targetCmdMC = `        const response = handleArenaTop();
        message.reply(response).catch(()=>{});
        return;
      }`;
const replaceCmdMC = `        const response = handleArenaTop();
        message.reply(response).catch(()=>{});
        return;
      }
      if (args[0] === 'accept') {
        const response = handleArenaAccept(playerIdentifier, message.author.username);
        message.reply(response).catch(()=>{});
        return;
      }`;
mcCode = mcCode.replace(targetCmdMC, replaceCmdMC);
fs.writeFileSync('src/events/messageCreate.ts', mcCode, 'utf8');

// 3. Update interactionCreate.ts
let icCode = fs.readFileSync('src/events/interactionCreate.ts', 'utf8');
const icTarget = `      // Boss FSM`;
const icReplace = `      // Arena FSM
      if (interaction.customId.startsWith('arena')) {
        const action = interaction.customId.replace('arena', '');
        const { handleArenaAction } = require('../utils/rpg/arena');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleArenaAction(db, player, action, interaction.user.id);
        
        if (!resp.components || resp.components.length === 0) {
          await interaction.update({ embeds: resp.embeds, components: [], content: resp.content || '' });
        } else {
          await interaction.update(resp as any);
        }
        return;
      }

      // Boss FSM`;
icCode = icCode.replace(icTarget, icReplace);
fs.writeFileSync('src/events/interactionCreate.ts', icCode, 'utf8');
console.log('Interactive Arena Hooked.');
