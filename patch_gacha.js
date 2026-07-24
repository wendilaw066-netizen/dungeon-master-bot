const fs = require('fs');
let code = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const target1 = `  arenaRating?: number;
  pvpWins?: number;
  pvpLosses?: number;`;

const replace1 = `  arenaRating?: number;
  pvpWins?: number;
  pvpLosses?: number;
  gachaPity?: number;
  titles?: string[];
  activeTitle?: string;`;

code = code.replace(target1, replace1);

const target2 = `  if (p.arenaRating === undefined) p.arenaRating = 1000;
  if (p.pvpWins === undefined) p.pvpWins = 0;
  if (p.pvpLosses === undefined) p.pvpLosses = 0;`;

const replace2 = `  if (p.arenaRating === undefined) p.arenaRating = 1000;
  if (p.pvpWins === undefined) p.pvpWins = 0;
  if (p.pvpLosses === undefined) p.pvpLosses = 0;
  if (p.gachaPity === undefined) p.gachaPity = 0;
  if (!p.titles) p.titles = [];`;

code = code.replace(target2, replace2);

// Now patch the gacha logic
const gachaTarget = `  let dropCategory = 'common';
  if (roll < 5) dropCategory = 'legendary';       // 5% chance
  else if (roll < 20) dropCategory = 'epic';      // 15% chance
  else if (roll < 50) dropCategory = 'rare';      // 30% chance`;

const gachaReplace = `  let dropCategory = 'common';
  
  if (player.gachaPity! >= 10) {
    dropCategory = roll < 20 ? 'legendary' : 'epic'; // 20% Leg, 80% Epic on Pity
    player.gachaPity = 0;
  } else {
    if (roll < 5) dropCategory = 'legendary';       // 5% chance
    else if (roll < 20) dropCategory = 'epic';      // 15% chance
    else if (roll < 50) dropCategory = 'rare';      // 30% chance
  }`;

code = code.replace(gachaTarget, gachaReplace);

const dropTarget = `  player.items.push(itemDrop.name);
  saveMinigameDB(db);`;

const dropReplace = `  player.items.push(itemDrop.name);
  
  if (dropCategory === 'epic' || dropCategory === 'legendary') {
    player.gachaPity = 0;
  } else {
    player.gachaPity = (player.gachaPity || 0) + 1;
  }
  
  saveMinigameDB(db);`;

code = code.replace(dropTarget, dropReplace);

fs.writeFileSync('src/utils/minigame.ts', code, 'utf8');
console.log('Gacha pity added.');
