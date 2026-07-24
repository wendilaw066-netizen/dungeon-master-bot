const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

// 1. Import JOBS
const targetImport = `import { calculatePlayerStats, degradeEquipmentDurability } from './equipment';`;
const replaceImport = `import { calculatePlayerStats, degradeEquipmentDurability } from './equipment';\nimport { JOBS } from './jobs';`;
code = code.replace(targetImport, replaceImport);

// 2. Add Skill Button to Normal Dungeon UI
const targetButtons1 = `    new ButtonBuilder().setCustomId('dngflee').setLabel('Flee').setEmoji('🏃').setStyle(ButtonStyle.Secondary)
  );`;
const replaceButtons1 = `    new ButtonBuilder().setCustomId('dngflee').setLabel('Flee').setEmoji('🏃').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dngskill').setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary)
  );`;
code = code.replace(targetButtons1, replaceButtons1);

// 3. Add Skill Button to Boss Dungeon UI
const targetButtons2 = `    new ButtonBuilder().setCustomId('bossheal_' + bossBaseDamage).setLabel('Heal').setEmoji('🧪').setStyle(ButtonStyle.Success)
  );`;
const replaceButtons2 = `    new ButtonBuilder().setCustomId('bossheal_' + bossBaseDamage).setLabel('Heal').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bossskill_' + bossBaseDamage).setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary)
  );`;
code = code.replace(targetButtons2, replaceButtons2);

// 4. Implement dngskill in handleDungeonAction
const targetSkillLogic = `  } else if (action === 'dngheal') {`;
const replaceSkillLogic = `  } else if (action === 'dngskill') {
    const job = JOBS[player.job?.class] || JOBS['Novice'];
    const cat = job.category;
    let manaCost = 20;
    if (cat === 'Magic') manaCost = 30;
    if (cat === 'Support') manaCost = 25;
    if (cat === 'Ranged') manaCost = 15;
    if (cat === 'Sandbox') manaCost = 10;
    
    if ((player.mana || 0) < manaCost) {
      resultMsg += \`❌ Gagal menggunakan Skill! Butuh \${manaCost} Mana (Mana-mu: \${player.mana}). Kamu membuang giliranmu!\\n\`;
      player.hp -= monsterDamage;
      resultMsg += \`🩸 \${battle.name} menyerang dengan **\${monsterDamage}** damage!\\n\`;
    } else {
      player.mana -= manaCost;
      const { progressQuest } = require('./quests');
      progressQuest(player, 'use_skill', 1);

      if (cat === 'Melee') {
        const dmg = Math.floor(playerDamage * 2.5);
        battle.hp -= dmg;
        resultMsg += \`🌟 [MELEE SKILL] Kamu menebas dengan kuat memberikan **\${dmg}** damage!\\n\`;
      } else if (cat === 'Ranged') {
        const dmg = Math.floor(playerDamage * 1.5);
        battle.hp -= dmg;
        monsterDamage = Math.floor(monsterDamage * 0.5); // dodge half dmg
        resultMsg += \`🌟 [RANGED SKILL] Kamu menembak dari jauh (**\${dmg}** damage) dan menghindari separuh serangan!\\n\`;
      } else if (cat === 'Magic') {
        const dmg = Math.floor(playerDamage * 3.0);
        battle.hp -= dmg;
        player.hp -= Math.floor(dmg * 0.1); // 10% recoil
        resultMsg += \`🌟 [MAGIC SKILL] Kamu melontarkan sihir dahsyat (**\${dmg}** damage) namun terkena recoil.\\n\`;
      } else if (cat === 'Support') {
        const healAmt = Math.floor(player.maxHp * 0.4);
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        battle.hp -= playerDamage;
        resultMsg += \`🌟 [SUPPORT SKILL] Kamu memulihkan **\${healAmt}** HP dan memukul kecil (**\${playerDamage}** damage)!\\n\`;
      } else { // Sandbox / Novice
        const dmg = playerDamage;
        battle.hp -= dmg;
        player.gems += 50;
        resultMsg += \`🌟 [SANDBOX SKILL] Kamu melempar koin ke arah musuh (**\${dmg}** damage) dan mencuri 50 Gems!\\n\`;
      }

      if (battle.hp > 0) {
        player.hp -= monsterDamage;
        resultMsg += \`🩸 \${battle.name} balik menyerang dengan **\${monsterDamage}** damage!\\n\`;
      }
    }
  } else if (action === 'dngheal') {`;
code = code.replace(targetSkillLogic, replaceSkillLogic);

fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', code, 'utf8');
console.log('Skill button added to dungeon');
