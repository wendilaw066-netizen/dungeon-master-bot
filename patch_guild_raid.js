const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/guilds.ts', 'utf8');

const targetInterface = `  level: number;
  exp: number; // WLs donated
}`;
const replaceInterface = `  level: number;
  exp: number; // WLs donated
  activeRaid?: {
    hp: number;
    maxHp: number;
    level: number;
    startTime: number; // Date.now()
    participants: Record<string, boolean>; // userId -> hasAttackedToday
  };
}`;
code = code.replace(targetInterface, replaceInterface);

const targetAction = `  if (!action) {`;
const replaceAction = `  if (action === 'raid') {
    if (!player.guildId || !guilds[player.guildId]) return { content: '❌ Kamu tidak berada di Guild!' };
    const g = guilds[player.guildId];
    const subAction = args[1]?.toLowerCase();
    
    // Check if raid expired
    if (g.activeRaid && (Date.now() - g.activeRaid.startTime > 24 * 60 * 60 * 1000)) {
      if (g.activeRaid.hp <= 0) {
        // Raid was already dead, cleanup done below or here
      } else {
        g.activeRaid = undefined; // Failed
        saveGuilds(guilds);
        return { content: '💀 **Waktu Habis!** Guild-mu gagal mengalahkan Raid Boss dalam 24 jam.' };
      }
    }

    if (subAction === 'start') {
      if (g.ownerId !== userId) return { content: '❌ Hanya Ketua Guild yang bisa memulai Raid!' };
      if (g.activeRaid) return { content: '❌ Guild ini sedang melawan Raid Boss!' };
      if (g.level < 2) return { content: '❌ Guild harus minimal Level 2 untuk memulai Raid!' };
      
      const raidLvl = Math.floor(g.level / 2) || 1;
      g.activeRaid = {
        hp: 100000 * raidLvl * g.members.length,
        maxHp: 100000 * raidLvl * g.members.length,
        level: raidLvl,
        startTime: Date.now(),
        participants: {}
      };
      saveGuilds(guilds);
      return { content: \`👺 **RAID BOSS LEVEL \${raidLvl} MUNCUL!**\\nBoss ini memiliki **\${g.activeRaid.maxHp} HP**.\\nSeluruh anggota guild punya waktu 24 Jam. Ketik \\\`!guild raid attack\\\` untuk menyerang!\` };
    }

    if (subAction === 'attack') {
      if (!g.activeRaid) return { content: '❌ Tidak ada Raid Boss yang aktif! Suruh ketua ketik \`!guild raid start\`.' };
      if (g.activeRaid.participants[userId]) return { content: '❌ Kamu sudah menyerang Raid Boss hari ini! Istirahatlah.' };
      if (g.activeRaid.hp <= 0) return { content: '❌ Raid Boss sudah mati!' };

      const { calculatePlayerStats } = require('./equipment');
      const stats = calculatePlayerStats(player);
      const dmg = stats.attack * 5; // 5x multiplier for burst dmg
      
      g.activeRaid.hp -= dmg;
      g.activeRaid.participants[userId] = true;
      let msg = \`⚔️ Kamu menyerang Guild Raid Boss dan memberikan **\${dmg}** damage!\`;

      if (g.activeRaid.hp <= 0) {
        msg += \`\\n\\n🎉 **RAID BOSS KALAH!** Seluruh anggota guild akan menerima bonus material langka saat mereka online!\`;
        // Distribute rewards immediately to the killer, others will need a claim system, but for now we just give killer extra
        if (!player.materials) player.materials = {};
        player.materials['Dark Matter'] = (player.materials['Dark Matter'] || 0) + 1;
        player.materials['Mythril'] = (player.materials['Mythril'] || 0) + 2;
        msg += \`\\n🎁 (Loot kamu dimasukkan langsung ke inventory: 1x Dark Matter, 2x Mythril)\`;
        g.activeRaid = undefined; // Clear raid
        saveMinigameDB(db);
      } else {
        msg += \`\\n❤️ Sisa HP Boss: **\${g.activeRaid.hp} / \${g.activeRaid.maxHp}**\`;
      }
      
      saveGuilds(guilds);
      return { content: msg };
    }

    if (g.activeRaid) {
      const timeLeft = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - g.activeRaid.startTime));
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const embed = new EmbedBuilder().setColor('#8B0000').setTitle('👺 GUILD RAID AKTIF!');
      embed.setDescription(\`**Level \${g.activeRaid.level} Boss**\\nHP: **\${g.activeRaid.hp} / \${g.activeRaid.maxHp}**\\nSisa Waktu: \${hours} Jam\\n\\nKetik \\\`!guild raid attack\\\` untuk menyumbang damage hari ini!\`);
      return { embeds: [embed] };
    }

    return { content: 'Gunakan \`!guild raid start\` atau \`!guild raid attack\`.' };
  }

  if (!action) {`;
code = code.replace(targetAction, replaceAction);

fs.writeFileSync('src/utils/rpg/guilds.ts', code, 'utf8');
console.log('Added guild raid logic.');
