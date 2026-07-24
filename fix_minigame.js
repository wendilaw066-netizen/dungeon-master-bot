const fs = require('fs');
let f = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const target = "if (player.hp >= player.maxHp && player.mana >= (player.maxMana || 100))";
const replace = "if (player.hp >= player.maxHp && (player.mana || 0) >= (player.maxMana || 100))";

f = f.replace(target, replace);
fs.writeFileSync('src/utils/minigame.ts', f, 'utf8');
