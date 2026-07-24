const fs = require('fs');

// Patch interactionCreate.ts
let icCode = fs.readFileSync('src/events/interactionCreate.ts', 'utf8');
icCode = icCode.replace(
  "if (interaction.customId.startsWith('bossatk_') || interaction.customId.startsWith('bossdef_') || interaction.customId.startsWith('bossheal_')) {",
  "if (interaction.customId.startsWith('bossatk_') || interaction.customId.startsWith('bossdef_') || interaction.customId.startsWith('bossheal_') || interaction.customId.startsWith('bossskill_')) {"
);
icCode = icCode.replace(
  "const actStr = actionType === 'atk' ? 'attack' : (actionType === 'def' ? 'defend' : 'heal');",
  "const actStr = actionType === 'atk' ? 'attack' : (actionType === 'def' ? 'defend' : (actionType === 'skill' ? 'skill' : 'heal'));"
);
fs.writeFileSync('src/events/interactionCreate.ts', icCode, 'utf8');

// Patch dungeon_v2.ts handleBossAction
let dgCode = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

const bossSkillTarget = `  } else if (action === 'defend') {`;
const bossSkillReplace = `  } else if (action === 'skill') {
    const job = JOBS[player.job?.class] || JOBS['Novice'];
    const cat = job.category;
    let manaCost = 20;
    if (cat === 'Magic') manaCost = 30;
    if (cat === 'Support') manaCost = 25;
    if (cat === 'Ranged') manaCost = 15;
    if (cat === 'Sandbox') manaCost = 10;
    
    if ((player.mana || 0) < manaCost) {
      resultMsg += \`❌ Gagal menggunakan Skill! Butuh \${manaCost} Mana (Mana-mu: \${player.mana}). Kamu membuang giliranmu!\\n\`;
      player.hp -= bossDamage;
      resultMsg += \`🩸 \${boss.name} menyerang dengan **\${bossDamage}** damage!\\n\`;
    } else {
      player.mana -= manaCost;
      const { progressQuest } = require('./quests');
      progressQuest(player, 'use_skill', 1);

      if (boss.state === 'CHARGING') {
        bossDamage = bossBaseDamage * 5;
        resultMsg += '💀 Kamu mencoba skill saat boss sedang CHARGING! Terkena serangan fatal!\\n';
        player.hp -= bossDamage;
      } else {
        if (cat === 'Melee') {
          const dmg = Math.floor(playerDamage * 2.5);
          boss.hp -= dmg;
          resultMsg += \`🌟 [MELEE SKILL] Kamu menebas Boss dengan kuat (**\${dmg}** damage)!\\n\`;
        } else if (cat === 'Ranged') {
          const dmg = Math.floor(playerDamage * 1.5);
          boss.hp -= dmg;
          bossDamage = Math.floor(bossDamage * 0.5); // dodge half dmg
          resultMsg += \`🌟 [RANGED SKILL] Kamu menembak dari jauh (**\${dmg}** damage) dan menghindari separuh serangan!\\n\`;
        } else if (cat === 'Magic') {
          const dmg = Math.floor(playerDamage * 3.0);
          boss.hp -= dmg;
          player.hp -= Math.floor(dmg * 0.1); // 10% recoil
          resultMsg += \`🌟 [MAGIC SKILL] Kamu melontarkan sihir dahsyat (**\${dmg}** damage) namun terkena recoil.\\n\`;
        } else if (cat === 'Support') {
          const healAmt = Math.floor(player.maxHp * 0.4);
          player.hp = Math.min(player.maxHp, player.hp + healAmt);
          boss.hp -= playerDamage;
          resultMsg += \`🌟 [SUPPORT SKILL] Kamu memulihkan **\${healAmt}** HP dan memukul kecil (**\${playerDamage}** damage)!\\n\`;
        } else { // Sandbox / Novice
          const dmg = playerDamage;
          boss.hp -= dmg;
          player.gems += 50;
          resultMsg += \`🌟 [SANDBOX SKILL] Kamu melempar koin (**\${dmg}** damage) dan mencuri 50 Gems!\\n\`;
        }

        if (boss.hp > 0) {
          player.hp -= bossDamage;
          resultMsg += \`🩸 \${boss.name} balik menyerang dengan **\${bossDamage}** damage!\\n\`;
        }
      }
    }
  } else if (action === 'defend') {`;

dgCode = dgCode.replace(bossSkillTarget, bossSkillReplace);
fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', dgCode, 'utf8');
console.log('Patched boss skill logic');
