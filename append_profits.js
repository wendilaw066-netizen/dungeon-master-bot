const fs = require('fs');

let f = fs.readFileSync('src/utils/rpg/auction.ts', 'utf8');

// We just append + profitMsg to all .setDescription(...)
f = f.replace(/\.setDescription\(`(.*?)`\)/g, '.setDescription(`$1` + profitMsg)');
f = f.replace(/\.setDescription\('(.*?)'\)/g, '.setDescription(\'$1\' + profitMsg)');

// Also for desc + profitMsg
f = f.replace(/\.setDescription\(desc\)/g, '.setDescription(desc + profitMsg)');

fs.writeFileSync('src/utils/rpg/auction.ts', f);
