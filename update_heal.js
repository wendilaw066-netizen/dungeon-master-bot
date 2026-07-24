const fs = require('fs');

let f = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const oldHealCondition = `  if (player.hp >= player.maxHp) return \`Darah kamu udah penuh bro! Nggak usah sok sakit.\`;`;
const newHealCondition = `  if (player.hp >= player.maxHp && player.mana >= (player.maxMana || 100)) return \`Darah & Mana kamu udah penuh bro! Nggak usah sok sakit.\`;`;

const oldMedkit = `    player.items.splice(medkitIndex, 1);
    player.hp = player.maxHp;
    saveMinigameDB(db);
    return \`🏥 Kamu pakai Medkit dari tas. Nyawa kembali penuh (\${player.maxHp}/\${player.maxHp})!\`;`;
const newMedkit = `    player.items.splice(medkitIndex, 1);
    player.hp = player.maxHp;
    player.mana = player.maxMana || 100;
    saveMinigameDB(db);
    return \`🏥 Kamu pakai Medkit dari tas. Nyawa & Mana kembali penuh (\${player.maxHp} HP, \${player.mana} 🔵)!\`;`;

const oldHospital = `  player.wls -= cost;
  player.hp = player.maxHp;
  saveMinigameDB(db);
  
  return \`🏥 Kamu dirawat di rumah sakit. Bayar \${cost} WL, nyawa penuh lagi (\${player.maxHp}/\${player.maxHp})!\`;`;
const newHospital = `  player.wls -= cost;
  player.hp = player.maxHp;
  player.mana = player.maxMana || 100;
  saveMinigameDB(db);
  
  return \`🏥 Kamu dirawat di rumah sakit. Bayar \${cost} WL, Nyawa & Mana penuh lagi (\${player.maxHp} HP, \${player.mana} 🔵)!\`;`;

f = f.replace(oldHealCondition, newHealCondition);
f = f.replace(oldMedkit, newMedkit);
f = f.replace(oldHospital, newHospital);

fs.writeFileSync('src/utils/minigame.ts', f, 'utf8');
