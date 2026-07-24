const fs = require('fs');
let f = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const target = `  activeDungeonBattle?: {
    hp: number;
    maxHp: number;
    name: string;
    damage: number;
    diff: number;
    chap: number;
    stage: number;
  } | null;`;

const replace = `  activeDungeonBattle?: {
    hp: number;
    maxHp: number;
    name: string;
    damage: number;
    diff: number;
    chap: number;
    stage: number;
    state?: string;
  } | null;`;

f = f.replace(target, replace);
fs.writeFileSync('src/utils/minigame.ts', f, 'utf8');
