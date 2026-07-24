const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const importTarget = `import { handleEquip, handleUnequip, handleRepair } from '../utils/rpg/equipment';`;
const importReplace = `import { handleEquip, handleUnequip, handleRepair, handleForge } from '../utils/rpg/equipment';`;
code = code.replace(importTarget, importReplace);

const commandTarget = `    } else if (minigameCmd === '!repair') {`;
const commandReplace = `    } else if (minigameCmd === '!forge') {
      const itemName = args.join(' ');
      if (!itemName) {
        message.reply('❌ Gunakan: \`!forge <nama_barang>\`').catch(()=>{});
        return;
      }
      const response = handleForge(db, player, itemName);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!repair') {`;
code = code.replace(commandTarget, commandReplace);

fs.writeFileSync('src/events/messageCreate.ts', code, 'utf8');
console.log('Hooked forge in messageCreate');
