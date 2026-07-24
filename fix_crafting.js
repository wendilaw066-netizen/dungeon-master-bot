const fs = require('fs');

let f = fs.readFileSync('src/utils/rpg/crafting.ts', 'utf8');
f = f.replace(/\\\$/g, '$');
f = f.replace(/\\`/g, '\`');
f = f.replace(/\\n/g, '\n');
fs.writeFileSync('src/utils/rpg/crafting.ts', f);
console.log('Fixed crafting.ts');
