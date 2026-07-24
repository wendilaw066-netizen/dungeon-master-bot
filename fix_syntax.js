const fs = require('fs');
let f = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

// Undo the bad replace
f = f.replace(
  "{ name: 'User', value: `\${message.author.tag} (<@\${userId}>)`, inline: true },\\n          { name: '🔵 Mana', value: `**\${p.mana || 0}** / \${p.maxMana || 100}`, inline: true },",
  "{ name: 'User', value: `\${message.author.tag} (<@\${userId}>)`, inline: true },"
);

// Do the correct replace in !inv
const invTarget = `{ name: 'Tingkat Geng', value: \`**\${p.factionRank || 'Anggota'}**\`, inline: true }`;
const invReplace = `{ name: 'Tingkat Geng', value: \`**\${p.factionRank || 'Anggota'}**\`, inline: true },\n          { name: '🔵 Mana', value: \`**\${p.mana || 0}** / \${p.maxMana || 100}\`, inline: true }`;

f = f.replace(invTarget, invReplace);

fs.writeFileSync('src/events/messageCreate.ts', f, 'utf8');
