const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/equipment.ts', 'utf8');

const importSearch = `import { MinigameDB, PlayerInventory, saveMinigameDB } from '../minigame';`;
const importReplace = `import { MinigameDB, PlayerInventory, saveMinigameDB } from '../minigame';\nimport { loadGuilds } from './guilds';`;
code = code.replace(importSearch, importReplace);

const statSearch = `  const jobMultipliers = getJobBonusMultiplier(player);
  
  const finalHp = Math.floor(baseHp * jobMultipliers.hp);
  const finalAtk = Math.floor(baseAtk * jobMultipliers.attack);`;
const statReplace = `  const jobMultipliers = getJobBonusMultiplier(player);
  
  let guildBuff = 1.0;
  if (player.guildId) {
    const guilds = loadGuilds();
    if (guilds[player.guildId]) {
      guildBuff = 1.0 + (guilds[player.guildId].level * 0.05); // +5% per level
    }
  }

  const finalHp = Math.floor(baseHp * jobMultipliers.hp * guildBuff);
  const finalAtk = Math.floor(baseAtk * jobMultipliers.attack * guildBuff);`;
code = code.replace(statSearch, statReplace);

const repairSearch = `  const cost = 5; // 5 WL per repair
  if (player.wls < cost) return \`Kurang modal! Bengkel minta **\${cost} WL** buat benerin \${eq.name}.\`;
  
  player.wls -= cost;
  eq.durability = 100;
  
  calculatePlayerStats(player); // Recalculate in case it was 0% and now gives stats again
  saveMinigameDB(db);
  
  return \`🛠️ *CLINK CLANK CLINK!* **\${eq.name}** berhasil diperbaiki menjadi 100% mulus dengan biaya \${cost} WL!\`;`;
const repairReplace = `  const cost = 5; // 5 WL per repair
  let requiredMaterial = 'Wood';
  if (eq.name.toLowerCase().includes('iron') || eq.name.toLowerCase().includes('sword') || eq.name.toLowerCase().includes('armor')) requiredMaterial = 'Iron Ore';
  if (eq.name.toLowerCase().includes('magic') || eq.name.toLowerCase().includes('staff') || eq.name.toLowerCase().includes('robe')) requiredMaterial = 'Magic Dust';
  if (eq.name.toLowerCase().includes('dragon') || eq.name.toLowerCase().includes('excalibur')) requiredMaterial = 'Dragon Scale';

  if (!player.materials) player.materials = {};
  const matCount = player.materials[requiredMaterial] || 0;
  
  if (player.wls < cost) return \`Kurang modal! Bengkel minta **\${cost} WL** buat benerin \${eq.name}.\`;
  if (matCount < 1) return \`Kurang material! Bengkel minta **1x \${requiredMaterial}** untuk memperbaiki \${eq.name} (Kamu punya \${matCount}). Cari di Dungeon!\`;
  
  player.wls -= cost;
  player.materials[requiredMaterial] -= 1;
  eq.durability = 100;
  
  calculatePlayerStats(player); // Recalculate in case it was 0% and now gives stats again
  const { progressQuest } = require('./quests');
  progressQuest(player, 'craft', 1); // Repair counts as craft for quests
  saveMinigameDB(db);
  
  return \`🛠️ *CLINK CLANK CLINK!* **\${eq.name}** berhasil diperbaiki 100% mulus! (Biaya: \${cost} WL & 1 \${requiredMaterial})\`;`;
code = code.replace(repairSearch, repairReplace);

fs.writeFileSync('src/utils/rpg/equipment.ts', code, 'utf8');
console.log('Patched equipment.ts');
