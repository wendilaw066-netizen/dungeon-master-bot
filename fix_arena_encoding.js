const fs = require('fs');

let code = fs.readFileSync('src/utils/rpg/arena.ts', 'utf8');

// Replace corrupted emojis in arena.ts
code = code.replace(/return { content: \`[^]+?\*\*\$\{challengerName\}\*\*/, "return { content: \`\\u2694\\ufe0f **\${challengerName}**");
code = code.replace(/setTitle\('dY\?\+ Top 10 Arena Leaderboard'\)/, "setTitle('\\ud83c\\udfc6 Top 10 Arena Leaderboard')");

fs.writeFileSync('src/utils/rpg/arena.ts', code, 'utf8');
