const fs = require('fs');

// 1. Hook into messageCreate.ts
let mcCode = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const targetImport = `import { handleForge } from '../utils/rpg/equipment';`;
const replaceImport = `import { handleForge } from '../utils/rpg/equipment';
import { renderDashboard } from '../utils/rpg/dashboard';`;
if (mcCode.includes(targetImport)) {
  mcCode = mcCode.replace(targetImport, replaceImport);
} else {
  // alternative location if import is slightly different
  mcCode = mcCode.replace(`import { handleEquip, handleUnequip, handleRepair, handleForge } from '../utils/rpg/equipment';`, `import { handleEquip, handleUnequip, handleRepair, handleForge } from '../utils/rpg/equipment';\nimport { renderDashboard } from '../utils/rpg/dashboard';`);
}

const targetCmd = `    } else if (minigameCmd === '!farm') {`;
const replaceCmd = `    } else if (minigameCmd === '!dashboard') {
      doV2Command(async (db: any, player: any) => {
        const resp = renderDashboard(player, message.author.username);
        try {
          if (message.guild) await message.delete();
        } catch (e) {} // ignore missing perm
        message.channel.send(resp).catch(()=>{});
        return '';
      });
      return;
    } else if (minigameCmd === '!farm') {`;
mcCode = mcCode.replace(targetCmd, replaceCmd);
fs.writeFileSync('src/events/messageCreate.ts', mcCode, 'utf8');

// 2. Hook into interactionCreate.ts
let icCode = fs.readFileSync('src/events/interactionCreate.ts', 'utf8');

const icTarget = `      // Arena FSM`;
const icReplace = `      // Dashboard FSM
      if (interaction.customId.startsWith('dash_')) {
        const action = interaction.customId.replace('dash_', '');
        const { handleDashboardAction } = require('../utils/rpg/dashboard');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleDashboardAction(db, player, action, interaction.user.username);
        
        await interaction.update(resp as any);
        return;
      }

      // Arena FSM`;
icCode = icCode.replace(icTarget, icReplace);
fs.writeFileSync('src/events/interactionCreate.ts', icCode, 'utf8');
console.log('Hooked dashboard in events');
