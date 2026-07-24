import * as fs from 'fs';
import * as path from 'path';
import { PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { EmbedBuilder } from 'discord.js';

export interface Guild {
  id: string;
  name: string;
  ownerId: string;
  members: string[]; // User IDs
  level: number;
  exp: number; // Coins donated
  activeRaid?: {
    hp: number;
    maxHp: number;
    level: number;
    startTime: number; // Date.now()
    participants: Record<string, boolean>; // userId -> hasAttackedToday
  };
}

const GUILDS_FILE = path.join(__dirname, '..', '..', '..', 'guilds.json');

export function loadGuilds(): Record<string, Guild> {
  if (!fs.existsSync(GUILDS_FILE)) {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify({}), 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf8'));
}

export function saveGuilds(data: Record<string, Guild>) {
  fs.writeFileSync(GUILDS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getExpRequiredForLevel(level: number): number {
  return level * 100; // e.g. Lv1 -> 100 Coins, Lv2 -> 200 Coins
}

export function handleGuildCommand(args: string[], userId: string, authorName: string): any {
  const db = require('../minigame').loadMinigameDB();
  const player = getPlayer(db, userId);
  const guilds = loadGuilds();

  const action = args[0]?.toLowerCase();

  if (action === 'raid') {
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
      return { content: `👺 **RAID BOSS LEVEL ${raidLvl} MUNCUL!**\nBoss ini memiliki **${g.activeRaid.maxHp} HP**.\nSeluruh anggota guild punya waktu 24 Jam. Ketik \`!guild raid attack\` untuk menyerang!` };
    }

    if (subAction === 'attack') {
      if (!g.activeRaid) return { content: '❌ Tidak ada Raid Boss yang aktif! Suruh ketua ketik `!guild raid start`.' };
      if (g.activeRaid.participants[userId]) return { content: '❌ Kamu sudah menyerang Raid Boss hari ini! Istirahatlah.' };
      if (g.activeRaid.hp <= 0) return { content: '❌ Raid Boss sudah mati!' };

      const { calculatePlayerStats } = require('./equipment');
      const stats = calculatePlayerStats(player);
      const dmg = stats.attack * 5; // 5x multiplier for burst dmg
      
      g.activeRaid.hp -= dmg;
      g.activeRaid.participants[userId] = true;
      let msg = `⚔️ Kamu menyerang Guild Raid Boss dan memberikan **${dmg}** damage!`;

      if (g.activeRaid.hp <= 0) {
        msg += `\n\n🎉 **RAID BOSS KALAH!** Seluruh anggota guild akan menerima bonus material langka saat mereka online!`;
        // Distribute rewards immediately to the killer, others will need a claim system, but for now we just give killer extra
        if (!player.materials) player.materials = {};
        player.materials['Dark Matter'] = (player.materials['Dark Matter'] || 0) + 1;
        player.materials['Mythril'] = (player.materials['Mythril'] || 0) + 2;
        msg += `\n🎁 (Loot kamu dimasukkan langsung ke inventory: 1x Dark Matter, 2x Mythril)`;
        g.activeRaid = undefined; // Clear raid
        saveMinigameDB(db);
      } else {
        msg += `\n❤️ Sisa HP Boss: **${g.activeRaid.hp} / ${g.activeRaid.maxHp}**`;
      }
      
      saveGuilds(guilds);
      return { content: msg };
    }

    if (g.activeRaid) {
      const timeLeft = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - g.activeRaid.startTime));
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const embed = new EmbedBuilder().setColor('#8B0000').setTitle('👺 GUILD RAID AKTIF!');
      embed.setDescription(`**Level ${g.activeRaid.level} Boss**\nHP: **${g.activeRaid.hp} / ${g.activeRaid.maxHp}**\nSisa Waktu: ${hours} Jam\n\nKetik \`!guild raid attack\` untuk menyumbang damage hari ini!`);
      return { embeds: [embed] };
    }

    return { content: 'Gunakan `!guild raid start` atau `!guild raid attack`.' };
  }

  if (!action) {
    let embed = new EmbedBuilder().setColor('#0099ff').setTitle('🏰 Sistem Guild');
    if (player.guildId && guilds[player.guildId]) {
      const g = guilds[player.guildId];
      const req = getExpRequiredForLevel(g.level);
      const buff = g.level * 5;
      embed.setDescription(`Kamu adalah anggota dari guild **${g.name}**.\n\n**Level:** ${g.level}\n**Exp (Donasi Coin):** ${g.exp} / ${req}\n**Anggota:** ${g.members.length}\n\n**Buff Aktif:** +${buff}% ATK & Max HP\n\nGunakan \`!guild donate <jumlah>\` untuk menyumbang Coin.`);
    } else {
      embed.setDescription(`Kamu belum tergabung dalam Guild.\n\n\`!guild create <nama>\` - Bikin Guild (Biaya 50 Coin)\n\`!guild join <id>\` - Bergabung ke Guild`);
    }
    return { embeds: [embed] };
  }

  if (action === 'create') {
    if (player.guildId) return { content: '❌ Kamu sudah ada di dalam guild!' };
    const name = args.slice(1).join(' ');
    if (!name || name.length < 3) return { content: '❌ Nama guild minimal 3 huruf!' };
    
    if (player.coins < 50) return { content: '❌ Miskin! Bikin guild butuh 50 Coin.' };

    const guildId = 'G' + Math.floor(Math.random() * 1000000);
    guilds[guildId] = {
      id: guildId,
      name: name,
      ownerId: userId,
      members: [userId],
      level: 1,
      exp: 0
    };
    player.coins -= 50;
    player.guildId = guildId;
    
    saveMinigameDB(db);
    saveGuilds(guilds);

    return { content: `🏰 **Selamat!** Kamu berhasil mendirikan Guild **${name}** (ID: \`${guildId}\`)!` };
  }

  if (action === 'join') {
    if (player.guildId) return { content: '❌ Kamu sudah ada di dalam guild!' };
    const targetId = args[1];
    if (!targetId || !guilds[targetId]) return { content: '❌ ID Guild tidak ditemukan!' };
    
    guilds[targetId].members.push(userId);
    player.guildId = targetId;
    
    saveMinigameDB(db);
    saveGuilds(guilds);
    return { content: `🤝 Kamu berhasil bergabung ke guild **${guilds[targetId].name}**!` };
  }

  if (action === 'donate') {
    if (!player.guildId || !guilds[player.guildId]) return { content: '❌ Kamu tidak berada di Guild!' };
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) return { content: '❌ Masukkan jumlah donasi Coin yang benar!' };
    if (player.coins < amount) return { content: `❌ Coin kamu cuma punya ${player.coins}. Nggak cukup buat donasi segitu.` };

    const g = guilds[player.guildId];
    player.coins -= amount;
    g.exp += amount;

    let levelUp = false;
    let req = getExpRequiredForLevel(g.level);
    while (g.exp >= req) {
      g.exp -= req;
      g.level++;
      levelUp = true;
      req = getExpRequiredForLevel(g.level);
    }

    saveMinigameDB(db);
    saveGuilds(guilds);

    let msg = `💸 Kamu mendonasikan **${amount} Coin** ke Guild **${g.name}**!`;
    if (levelUp) {
      msg += `\n🎉 **LEVEL UP!** Guild naik ke level **${g.level}**! Buff meningkat jadi +${g.level * 5}% ATK & HP.`;
    }
    return { content: msg };
  }

  return { content: '❌ Perintah tidak dikenali.' };
}
