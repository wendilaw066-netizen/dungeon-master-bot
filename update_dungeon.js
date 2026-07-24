const fs = require('fs');

let f = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

// 1. Render dungeon battle UI
f = f.replace(
  "{ name: 'Your HP', value: '**' + player.hp + '** / ' + player.maxHp, inline: true }",
  "{ name: 'Your HP', value: '**' + player.hp + '** / ' + player.maxHp + '\\n🔵 **Mana:** ' + (player.mana || 0) + ' / ' + (player.maxMana || 100), inline: true }"
);

f = f.replace(
  "new ButtonBuilder().setCustomId('dngheal').setLabel('Heal').setEmoji('💊').setStyle(ButtonStyle.Success),",
  "new ButtonBuilder().setCustomId('dngheal').setLabel('Heal').setEmoji('💊').setStyle(ButtonStyle.Success),\n    new ButtonBuilder().setCustomId('dngskill').setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary),"
);

// 2. Boss Battle UI
f = f.replace(
  "{ name: 'Your HP', value: '**' + player.hp + '** / ' + player.maxHp, inline: true }",
  "{ name: 'Your HP', value: '**' + player.hp + '** / ' + player.maxHp + '\\n🔵 **Mana:** ' + (player.mana || 0) + ' / ' + (player.maxMana || 100), inline: true }"
);

f = f.replace(
  "new ButtonBuilder().setCustomId('bossheal_' + bossBaseDamage).setLabel('Heal').setEmoji('💊').setStyle(ButtonStyle.Success)",
  "new ButtonBuilder().setCustomId('bossheal_' + bossBaseDamage).setLabel('Heal').setEmoji('💊').setStyle(ButtonStyle.Success),\n    new ButtonBuilder().setCustomId('bossskill_' + bossBaseDamage).setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary)"
);

fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', f, 'utf8');
