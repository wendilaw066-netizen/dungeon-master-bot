const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

// 1. Telegraphed Attacks in Dungeon Battle
const dngSearch = `  if (action === 'dngatk') {
    battle.hp -= playerDamage;
    resultMsg += \`⚔️ Kamu menyerang dengan **\${playerDamage}** damage!\\n\`;
    if (battle.hp > 0) {
      player.hp -= monsterDamage;
      resultMsg += \`💥 \${battle.name} balik menyerang dengan **\${monsterDamage}** damage!\\n\`;
    }
  } else if (action === 'dngdef') {
    monsterDamage = Math.floor(monsterDamage * 0.3);
    player.hp -= monsterDamage;
    resultMsg += \`🛡️ Kamu menahan serangan! Hanya terkena **\${monsterDamage}** damage.\\n\`;
  }`;

const dngReplace = `  if (action === 'dngatk') {
    if (battle.state === 'CHARGING') {
      monsterDamage *= 3; // Fatal damage
      player.hp -= monsterDamage;
      resultMsg += \`💥 Kamu menyerang saat \${battle.name} sedang CHARGING! Terkena serangan fatal **\${monsterDamage}** damage!\\n\`;
    } else {
      battle.hp -= playerDamage;
      resultMsg += \`⚔️ Kamu menyerang dengan **\${playerDamage}** damage!\\n\`;
      if (battle.hp > 0) {
        player.hp -= monsterDamage;
        resultMsg += \`💥 \${battle.name} balik menyerang dengan **\${monsterDamage}** damage!\\n\`;
      }
    }
  } else if (action === 'dngdef') {
    if (battle.state === 'CHARGING') {
      monsterDamage = Math.floor(monsterDamage * 0.2); // Parry
      player.hp -= monsterDamage;
      resultMsg += \`🛡️ PARRY BERHASIL! Kamu menahan serangan mematikan \${battle.name} dan hanya terkena **\${monsterDamage}** damage! Monster terkena STUN!\\n\`;
      battle.state = 'STUNNED';
    } else {
      monsterDamage = Math.floor(monsterDamage * 0.3);
      player.hp -= monsterDamage;
      resultMsg += \`🛡️ Kamu menahan serangan! Hanya terkena **\${monsterDamage}** damage.\\n\`;
    }
  }`;

code = code.replace(dngSearch, dngReplace);

// We need to implement state transition for Dungeon Mobs
const dngEndSearch = `  // Passive Mana Regen
  if (player.mana !== undefined && player.maxMana) {
    player.mana = Math.min(player.maxMana, player.mana + 5);
  }`;

const dngEndReplace = `  // Passive Mana Regen
  if (player.mana !== undefined && player.maxMana) {
    player.mana = Math.min(player.maxMana, player.mana + 5);
  }

  // AI State Transition
  if (battle.hp > 0) {
    if (battle.state === 'STUNNED') {
      battle.state = 'NORMAL';
      resultMsg += \`\\n🌀 \${battle.name} pulih dari stun.\`;
    } else if (battle.state === 'CHARGING' && action !== 'dngdef') {
      battle.state = 'NORMAL'; // Charge used up
    } else if (Math.random() < 0.25) { // 25% chance to charge
      battle.state = 'CHARGING';
      resultMsg += \`\\n⚠️ **\${battle.name} MENGAMBIL NAPAS PANJANG!** (Serangan fatal di ronde berikutnya!)\`;
    }
  }`;
code = code.replace(dngEndSearch, dngEndReplace);

// Also need to handle 'dngskill' action so they don't bypass charge penalty
const skillSearch = `  } else if (action === 'dngskill') {`;
const skillReplace = `  } else if (action === 'dngskill') {
    if (battle.state === 'CHARGING') {
      monsterDamage *= 3; // Fatal damage
      player.hp -= monsterDamage;
      resultMsg += \`💥 Kamu menggunakan Skill saat \${battle.name} sedang CHARGING! Terkena serangan fatal **\${monsterDamage}** damage!\\n\`;
      battle.state = 'NORMAL';
    }`;
code = code.replace(skillSearch, skillReplace);


fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', code, 'utf8');
console.log('Done patching dungeon AI.');
