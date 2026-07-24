const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

code = code.replace(/player\.mana -= manaCost;/g, "player.mana = (player.mana || 0) - manaCost;");

fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', code, 'utf8');
