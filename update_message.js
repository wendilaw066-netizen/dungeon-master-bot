const fs = require('fs');

let f = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

// Update !inv to show mana
f = f.replace(
  "inline: true }",
  "inline: true },\\n          { name: '🔵 Mana', value: \`**\${p.mana || 0}** / \${p.maxMana || 100}\`, inline: true }"
);

// Update !tavern to restore mana
const oldTavern = `p.hp = p.maxHp;
        saveMinigameDB(db);
        const embed = new EmbedBuilder()
          .setTitle('🍺 Tavern')
          .setDescription(\`Kamu menyewa kamar di Tavern seharga **10 WLs**.\\nKamu tidur nyenyak dan HP-mu kembali penuh (\${p.maxHp} HP)!\`)`;

const newTavern = `p.hp = p.maxHp;
        p.mana = p.maxMana || 100;
        saveMinigameDB(db);
        const embed = new EmbedBuilder()
          .setTitle('🍺 Tavern')
          .setDescription(\`Kamu menyewa kamar di Tavern seharga **10 WLs**.\\nKamu tidur nyenyak. HP dan Mana-mu kembali penuh (\${p.maxHp} HP, \${p.maxMana} 🔵)!\`)`;

f = f.replace(oldTavern, newTavern);

fs.writeFileSync('src/events/messageCreate.ts', f, 'utf8');
