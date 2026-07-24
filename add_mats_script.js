const fs = require('fs');

const path = 'src/utils/rpg/dungeon_v2.ts';
let content = fs.readFileSync(path, 'utf8');

const materialLogicTDiff = `
    const materialsPool = [
      ['Wood', 'Iron Ore'],
      ['Iron Ore', 'Magic Dust'],
      ['Magic Dust', 'Dragon Scale'],
      ['Dragon Scale', 'Mythril'],
      ['Mythril', 'Dark Matter']
    ];
    let matDrop = '';
    let matCount = 0;
    if (Math.random() < 0.6) {
      const pool = materialsPool[tDiff] || materialsPool[0];
      matDrop = pool[Math.floor(Math.random() * pool.length)];
      matCount = Math.floor(Math.random() * 3) + 1;
      if (!player.materials) player.materials = {};
      player.materials[matDrop] = (player.materials[matDrop] || 0) + matCount;
    }
`;

const materialLogicBattleDiff = materialLogicTDiff.replace(/tDiff/g, 'battle.diff');

content = content.replace(
  'const gtDrop = rollGtItemDrop(tDiff);',
  'const gtDrop = rollGtItemDrop(tDiff);' + materialLogicTDiff
);

content = content.replace(
  'const gtDrop = rollGtItemDrop(battle.diff);',
  'const gtDrop = rollGtItemDrop(battle.diff);' + materialLogicBattleDiff
);

// We also need to add it to the embed output.
// In resolveAutoDungeon:
const oldDropLine1 = "const gtDropLine = gtDrop ? `${RARITY_EMOJI_GT[gtDrop.rarity]} **${gtDrop.name}**` : null;";
const newDropLine1 = oldDropLine1 + "\\n    const matLine = matDrop ? `🔨 **${matCount}x ${matDrop}**` : null;";

content = content.replace(
  oldDropLine1,
  newDropLine1.replace(/\\\\n/g, '\\n')
);

// The exact string for Drops field:
const oldDropsField = "{ name: '🎁  Drops', value: dropLine + (gtDropLine ? `\\n${gtDropLine}` : ''), inline: false }";
const newDropsField = "{ name: '🎁  Drops', value: dropLine + (gtDropLine ? `\\n${gtDropLine}` : '') + (typeof matLine !== 'undefined' && matLine ? `\\n${matLine}` : ''), inline: false }";

content = content.split(oldDropsField).join(newDropsField);

fs.writeFileSync(path, content);
console.log('Material logic injected.');
