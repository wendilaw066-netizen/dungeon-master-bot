const fs = require('fs');
let f = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const oldHeal = `  const cost = 5; // 5 WL hospital bill
  if (player.wls < cost) return \`Rumah sakit nolak kamu! Butuh **\${cost} WL** buat berobat, kamu miskin. Beli medkit aja yang murah!\`;
  
  player.wls -= cost;
  player.hp = player.maxHp;
  player.mana = player.maxMana || 100;
  saveMinigameDB(db);
  
  return \`🏥 Kamu dirawat di rumah sakit. Bayar \${cost} WL, Nyawa & Mana penuh lagi (\${player.maxHp} HP, \${player.mana} 🔵)!\`;`;

const newHeal = `  player.hp = player.maxHp;
  player.mana = player.maxMana || 100;
  saveMinigameDB(db);
  
  return \`🏥 Kamu dirawat di klinik gratis. Nyawa & Mana penuh lagi (\${player.maxHp} HP, \${player.mana} 🔵)!\`;`;

f = f.replace(oldHeal, newHeal);
fs.writeFileSync('src/utils/minigame.ts', f, 'utf8');
