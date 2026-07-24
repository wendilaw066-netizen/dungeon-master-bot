const fs = require('fs');
let code = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const target1 = `  lastFarmTime: number;`;
const replace1 = `  lastFarmTime: number;
  dailyQuests?: { type: string, target: number, progress: number, completed: boolean, description: string }[];
  lastDailyDate?: string;`;

code = code.replace(target1, replace1);

const target2 = `  if (!p.swarm) {
    p.swarm = {
      mysticWood: 0,
      mysticAnimals: 0,
      zooLevel: 0,
      dailyCatch: 0,
      lastCatchDate: ''
    };
  }`;
const replace2 = `  if (!p.swarm) {
    p.swarm = {
      mysticWood: 0,
      mysticAnimals: 0,
      zooLevel: 0,
      dailyCatch: 0,
      lastCatchDate: ''
    };
  }
  if (!p.dailyQuests) p.dailyQuests = [];
  if (!p.lastDailyDate) p.lastDailyDate = '';`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/utils/minigame.ts', code, 'utf8');
