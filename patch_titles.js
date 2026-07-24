const fs = require('fs');

// 1. Pet Passives in calculatePlayerStats
let eqCode = fs.readFileSync('src/utils/rpg/equipment.ts', 'utf8');
const statTarget = `  const pet = player.equipment.pet;
  if (pet) {
    const s = getItemStats(pet.name);
    maxHp += s.hp;
    attack += s.attack;
  }

  // Also apply guild buffs`;

const statReplace = `  const pet = player.equipment.pet;
  if (pet) {
    const s = getItemStats(pet.name);
    maxHp += s.hp;
    attack += s.attack;
    
    // Pet Passives
    const pName = pet.name.toLowerCase();
    if (pName.includes('wolf') || pName.includes('dragon')) {
      attack = Math.floor(attack * 1.15); // 15% flat attack buff
    }
    if (pName.includes('fairy') || pName.includes('slime')) {
      maxHp = Math.floor(maxHp * 1.20); // 20% flat HP buff
    }
  }

  // Also apply guild buffs`;
eqCode = eqCode.replace(statTarget, statReplace);
fs.writeFileSync('src/utils/rpg/equipment.ts', eqCode, 'utf8');

// 2. Titles logic in messageCreate.ts
let mcCode = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

// Unlock titles check
const titleCheckTarget = `    // Ensure HP is capped on load
    if (player.hp > stats.maxHp) player.hp = stats.maxHp;`;
const titleCheckReplace = `    // Ensure HP is capped on load
    if (player.hp > stats.maxHp) player.hp = stats.maxHp;

    // Auto-unlock titles
    if (!player.titles) player.titles = [];
    const grantTitle = (t: string) => { if (!player.titles!.includes(t)) player.titles!.push(t); };
    if (player.wls >= 100) grantTitle('[Sultan]');
    if ((player.pvpWins || 0) >= 10) grantTitle('[Gladiator]');
    if (player.level >= 10) grantTitle('[Veteran]');
    if (player.level >= 20) grantTitle('[Legend]');`;
mcCode = mcCode.replace(titleCheckTarget, titleCheckReplace);

// Command logic for titles
const titleCmdTarget = `    } else if (minigameCmd === '!forge') {`;
const titleCmdReplace = `    } else if (minigameCmd === '!title') {
      const sub = args[0];
      if (!sub || sub === 'list') {
        const tList = player.titles?.join(', ') || 'Belum ada title.';
        message.reply(\`🏆 Title yang kamu miliki: \${tList}\\nKetik \\\`!title set <nama_title>\\\` untuk memasang.\`).catch(()=>{});
        return;
      }
      if (sub === 'set') {
        const tName = args.slice(1).join(' ');
        if (!player.titles?.includes(tName)) {
          message.reply(\`❌ Kamu belum membuka title tersebut!\`).catch(()=>{});
          return;
        }
        player.activeTitle = tName;
        saveMinigameDB(db);
        message.reply(\`✅ Title berhasil diubah menjadi **\${tName}**!\`).catch(()=>{});
        return;
      }
    } else if (minigameCmd === '!forge') {`;
mcCode = mcCode.replace(titleCmdTarget, titleCmdReplace);

fs.writeFileSync('src/events/messageCreate.ts', mcCode, 'utf8');
console.log('Titles and Pet Passives added.');
