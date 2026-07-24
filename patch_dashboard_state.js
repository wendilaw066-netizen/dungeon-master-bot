const fs = require('fs');

let mgCode = fs.readFileSync('src/utils/minigame.ts', 'utf8');
const targetMG = `  pendingArenaChallenge?: string;`;
const replaceMG = `  pendingArenaChallenge?: string;
  dashboardLog?: string[];`;
mgCode = mgCode.replace(targetMG, replaceMG);

const targetInit = `  if (!p.titles) p.titles = [];`;
const replaceInit = `  if (!p.titles) p.titles = [];
  if (!p.dashboardLog) p.dashboardLog = ['Dashboard diinisialisasi.'];`;
mgCode = mgCode.replace(targetInit, replaceInit);

fs.writeFileSync('src/utils/minigame.ts', mgCode, 'utf8');
