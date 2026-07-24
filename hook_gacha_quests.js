const fs = require('fs');
let code = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const gachaSearch = `  if (player.gems < cost) {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('❓ Miskin Gems').setDescription(\`Gems kamu nggak cukup. Butuh \${cost} Gems buat gacha!\`);
    return { embeds: [embed] };
  }

  player.gems -= cost;`;

const gachaReplace = `  if (player.gems < cost) {
    const embed = new EmbedBuilder().setColor('#ff0000').setTitle('❓ Miskin Gems').setDescription(\`Gems kamu nggak cukup. Butuh \${cost} Gems buat gacha!\`);
    return { embeds: [embed] };
  }

  player.gems -= cost;
  const { progressQuest } = require('./rpg/quests');
  progressQuest(player, 'gacha', 1);`;

code = code.replace(gachaSearch, gachaReplace);
fs.writeFileSync('src/utils/minigame.ts', code, 'utf8');
console.log('Hooked quests in gacha');
