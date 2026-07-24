const fs = require('fs');

let f = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

const importReplacement = `import { COLORS, fmt } from './ui';
import { degradeEquipmentDurability, calculatePlayerStats } from './equipment';
import { getSkillForJob } from './skills';`;

f = f.replace(
  "import { COLORS, fmt } from './ui';\nimport { degradeEquipmentDurability, calculatePlayerStats } from './equipment';",
  importReplacement
);
if (!f.includes('getSkillForJob')) {
  f = f.replace(
    "import { degradeEquipmentDurability, calculatePlayerStats } from './equipment';",
    "import { degradeEquipmentDurability, calculatePlayerStats } from './equipment';\nimport { getSkillForJob } from './skills';"
  );
}


// --- Dungeon Logic Injection ---
const oldDungeonSwitch = `switch (action) {
    case 'dngatk': {`;

const newDungeonSwitch = `
  // Restore some mana every turn
  if (player.mana !== undefined && player.maxMana !== undefined && player.mana < player.maxMana) {
    player.mana += 5;
    if (player.mana > player.maxMana) player.mana = player.maxMana;
  }

  switch (action) {
    case 'dngskill': {
      const skill = getSkillForJob(player.job);
      if (!skill) {
        return { 
          embeds: [new EmbedBuilder().setTitle('⚔️ Skill Gagal').setDescription('Job kamu belum memiliki skill aktif!').setColor(COLORS.error)], 
          components: [] 
        };
      }
      
      const pMana = player.mana || 0;
      if (pMana < skill.manaCost) {
        return { 
          embeds: [new EmbedBuilder().setTitle('⚔️ Skill Gagal').setDescription(\`Mana tidak cukup! Butuh \${skill.manaCost} 🔵, kamu punya \${pMana} 🔵.\`).setColor(COLORS.error)], 
          components: [] 
        };
      }
      
      // Consume mana
      player.mana = pMana - skill.manaCost;
      
      // Gain EXP
      if (!player.skillData) player.skillData = {};
      if (!player.skillData[skill.id]) player.skillData[skill.id] = { level: 1, exp: 0 };
      
      const sData = player.skillData[skill.id];
      sData.exp += 15;
      let levelUpText = '';
      if (sData.exp >= sData.level * 100) {
        sData.exp -= sData.level * 100;
        sData.level++;
        levelUpText = \`\\n\\n🌟 **Level Up!** \${skill.name} naik ke level \${sData.level}!\`;
      }
      
      const pStats = calculatePlayerStats(player);
      let pDmg = Math.floor(pStats.attack * skill.baseDamageMultiplier * (1 + (sData.level * 0.1))); // +10% per level
      
      let dmgText = '';
      if (skill.effect === 'lifesteal') {
        const heal = Math.floor(pDmg * 0.5);
        player.hp += heal;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        dmgText = \`Kamu menggunakan **\${skill.name}**! Menyedot **\${pDmg}** HP musuh dan memulihkan **\${heal}** HP!\`;
      } else if (skill.effect === 'heal') {
        pDmg = 0;
        const heal = Math.floor(pStats.maxHp * 0.3 * (1 + (sData.level * 0.1)));
        player.hp += heal;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        dmgText = \`Kamu menggunakan **\${skill.name}**! Memulihkan **\${heal}** HP!\`;
      } else if (skill.effect === 'stun') {
        dmgText = \`Kamu menggunakan **\${skill.name}**! Memberikan **\${pDmg}** DMG dan musuh pusing!\`;
        // skip monster attack
      } else {
         dmgText = \`Kamu menggunakan **\${skill.name}**! Memberikan **\${pDmg}** DMG kepada musuh!\`;
      }
      
      battle.hp -= pDmg;
      if (battle.hp <= 0) {
        return handleDungeonVictory(db, player);
      }
      
      let extraMsg = dmgText + levelUpText;
      if (skill.effect !== 'stun') {
         // Monster strikes back
         const mDmg = Math.floor(battle.damage * (0.8 + Math.random() * 0.4));
         player.hp -= mDmg;
         if (player.hp <= 0) {
           return handleDungeonDefeat(db, player);
         }
         extraMsg += \`\\n\\n\${battle.name} menyerang balik dan memberikan **\${mDmg}** DMG!\`;
      } else {
         extraMsg += \`\\n\\n\${battle.name} terkena STUN dan tidak bisa menyerang!\`;
      }
      
      degradeEquipmentDurability(player, 1);
      saveMinigameDB(db);
      return renderDungeonBattle(player, extraMsg);
    }
    case 'dngatk': {`;

f = f.replace(oldDungeonSwitch, newDungeonSwitch);


// --- Boss Logic Injection ---
const oldBossSwitch = `switch (subaction) {
    case 'bossatk': {`;

const newBossSwitch = `
  if (player.mana !== undefined && player.maxMana !== undefined && player.mana < player.maxMana) {
    player.mana += 5;
    if (player.mana > player.maxMana) player.mana = player.maxMana;
  }

  switch (subaction) {
    case 'bossskill': {
      const skill = getSkillForJob(player.job);
      if (!skill) {
        return { 
          embeds: [new EmbedBuilder().setTitle('⚔️ Skill Gagal').setDescription('Job kamu belum memiliki skill aktif!').setColor(COLORS.error)], 
          components: [] 
        };
      }
      
      const pMana = player.mana || 0;
      if (pMana < skill.manaCost) {
        return { 
          embeds: [new EmbedBuilder().setTitle('⚔️ Skill Gagal').setDescription(\`Mana tidak cukup! Butuh \${skill.manaCost} 🔵, kamu punya \${pMana} 🔵.\`).setColor(COLORS.error)], 
          components: [] 
        };
      }
      
      player.mana = pMana - skill.manaCost;
      
      if (!player.skillData) player.skillData = {};
      if (!player.skillData[skill.id]) player.skillData[skill.id] = { level: 1, exp: 0 };
      
      const sData = player.skillData[skill.id];
      sData.exp += 25; // Boss gives more exp
      let levelUpText = '';
      if (sData.exp >= sData.level * 100) {
        sData.exp -= sData.level * 100;
        sData.level++;
        levelUpText = \`\\n\\n🌟 **Level Up!** \${skill.name} naik ke level \${sData.level}!\`;
      }
      
      const pStats = calculatePlayerStats(player);
      let pDmg = Math.floor(pStats.attack * skill.baseDamageMultiplier * (1 + (sData.level * 0.1)));
      
      let dmgText = '';
      if (skill.effect === 'lifesteal') {
        const heal = Math.floor(pDmg * 0.5);
        player.hp += heal;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        dmgText = \`Kamu menggunakan **\${skill.name}**! Menyedot **\${pDmg}** HP boss dan memulihkan **\${heal}** HP!\`;
      } else if (skill.effect === 'heal') {
        pDmg = 0;
        const heal = Math.floor(pStats.maxHp * 0.3 * (1 + (sData.level * 0.1)));
        player.hp += heal;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        dmgText = \`Kamu menggunakan **\${skill.name}**! Memulihkan **\${heal}** HP!\`;
      } else if (skill.effect === 'stun') {
        dmgText = \`Kamu menggunakan **\${skill.name}**! Memberikan **\${pDmg}** DMG dan boss terkena stun!\`;
      } else {
         dmgText = \`Kamu menggunakan **\${skill.name}**! Memberikan **\${pDmg}** DMG kepada boss!\`;
      }
      
      boss.hp -= pDmg;
      if (boss.hp <= 0) {
        const dropWL = 50 + Math.floor(Math.random() * 50);
        player.wls += dropWL;
        player.activeBossBattle = null;
        saveMinigameDB(db);
        const embed = new EmbedBuilder()
          .setTitle('👑 Boss Terkalahkan!')
          .setDescription(\`Kamu mengalahkan **\${boss.name}**!\\n\\n\` + dmgText + levelUpText + \`\\n\\nKamu mendapatkan **\${dropWL}** WLs!\`)
          .setColor(COLORS.success);
        return { embeds: [embed], components: [] };
      }
      
      let extraMsg = dmgText + levelUpText;
      if (skill.effect !== 'stun') {
         const mDmg = Math.floor(bossBaseDamage * (0.8 + Math.random() * 0.4));
         player.hp -= mDmg;
         if (player.hp <= 0) {
           player.activeBossBattle = null;
           saveMinigameDB(db);
           const embed = new EmbedBuilder()
             .setTitle('💀 Kamu Mati!')
             .setDescription(\`Kamu mati dibunuh oleh **\${boss.name}**.\\nBoss pergi meninggalkanmu.\`)
             .setColor(COLORS.error);
           return { embeds: [embed], components: [] };
         }
         extraMsg += \`\\n\\n\${boss.name} menyerang balik dan memberikan **\${mDmg}** DMG!\`;
      } else {
         extraMsg += \`\\n\\n\${boss.name} terkena STUN dan tidak bisa menyerang!\`;
      }
      
      degradeEquipmentDurability(player, 2);
      saveMinigameDB(db);
      return renderBossBattle(player, bossBaseDamage, extraMsg);
    }
    case 'bossatk': {`;

f = f.replace(oldBossSwitch, newBossSwitch);

fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', f, 'utf8');
