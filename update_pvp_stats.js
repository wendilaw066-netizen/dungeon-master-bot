const fs = require('fs');
let code = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const target1 = `  dailyQuests?: { type: string, target: number, progress: number, completed: boolean, description: string }[];
  lastDailyDate?: string;`;

const replace1 = `  dailyQuests?: { type: string, target: number, progress: number, completed: boolean, description: string }[];
  lastDailyDate?: string;
  arenaRating?: number;
  pvpWins?: number;
  pvpLosses?: number;`;

code = code.replace(target1, replace1);

const target2 = `  if (!p.dailyQuests) p.dailyQuests = [];
  if (!p.lastDailyDate) p.lastDailyDate = '';`;

const replace2 = `  if (!p.dailyQuests) p.dailyQuests = [];
  if (!p.lastDailyDate) p.lastDailyDate = '';
  if (p.arenaRating === undefined) p.arenaRating = 1000;
  if (p.pvpWins === undefined) p.pvpWins = 0;
  if (p.pvpLosses === undefined) p.pvpLosses = 0;`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/utils/minigame.ts', code, 'utf8');
