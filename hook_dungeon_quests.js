const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/dungeon_v2.ts', 'utf8');

// Hook kill_mob
const killMobSearch = `  // Check Victory
  if (battle.hp <= 0) {
    player.activeDungeonBattle = null;`;
const killMobReplace = `  // Check Victory
  if (battle.hp <= 0) {
    player.activeDungeonBattle = null;
    const { progressQuest } = require('./quests');
    progressQuest(player, 'kill_mob', 1);`;
code = code.replace(killMobSearch, killMobReplace);

// Hook use_skill
const useSkillSearch = `  } else if (action === 'dngskill') {`;
const useSkillReplace = `  } else if (action === 'dngskill') {
    const { progressQuest } = require('./quests');
    progressQuest(player, 'use_skill', 1);`;
code = code.replace(useSkillSearch, useSkillReplace);

fs.writeFileSync('src/utils/rpg/dungeon_v2.ts', code, 'utf8');
console.log('Hooked quests in dungeon');
