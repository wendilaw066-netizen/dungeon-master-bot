const fs = require('fs');
let code = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const targetEmbed = `  const embed = new EmbedBuilder()
    .setColor(RARITY_COLORS[itemDrop.rarity as keyof typeof RARITY_COLORS] as any)
    .setTitle('🎰 Gacha Result!')
    .setDescription(\`Kamu mendapatkan \${RARITY_EMOJI[itemDrop.rarity as keyof typeof RARITY_EMOJI] || '❓'} **\${itemDrop.name}**!\`)
    .setFooter({ text: \`Sisa Gems: \${player.gems}\` });`;

const replaceEmbed = `  const embed = new EmbedBuilder()
    .setColor(RARITY_COLORS[itemDrop.rarity as keyof typeof RARITY_COLORS] as any)
    .setTitle('🎰 Gacha Result!')
    .setDescription(\`Kamu mendapatkan \${RARITY_EMOJI[itemDrop.rarity as keyof typeof RARITY_EMOJI] || '❓'} **\${itemDrop.name}**!\`)
    .setFooter({ text: \`Sisa Gems: \${player.gems} | Pity: \${player.gachaPity}/10\` });`;

code = code.replace(targetEmbed, replaceEmbed);
fs.writeFileSync('src/utils/minigame.ts', code, 'utf8');
