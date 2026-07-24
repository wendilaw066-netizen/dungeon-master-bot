const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');
code = code.split('\\\\`').join('`');
fs.writeFileSync('src/events/messageCreate.ts', code);
