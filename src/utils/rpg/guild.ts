import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { COLORS, fmt } from './ui';

const GUILD_DB_PATH = path.join(__dirname, '..', '..', '..', 'guild_db.json');

export interface GuildMember {
  userId: string;
  name: string;
  role: 'Leader' | 'Officer' | 'Member';
  donated: number;
}

export interface Guild {
  id: string; // 4 char hex
  name: string;
  level: number;
  exp: number;
  treasury: number; // Coins
  members: GuildMember[];
  bossHp: number;
  bossMaxHp: number;
  bossLevel: number;
}

export interface GuildDB {
  guilds: Record<string, Guild>;
}

let memoryDB: GuildDB | null = null;

export function loadGuildDB(): GuildDB {
  if (memoryDB) return memoryDB;
  if (!fs.existsSync(GUILD_DB_PATH)) {
    const defaultDB: GuildDB = { guilds: {} };
    fs.writeFileSync(GUILD_DB_PATH, JSON.stringify(defaultDB, null, 2));
    memoryDB = defaultDB;
    return defaultDB;
  }
  memoryDB = JSON.parse(fs.readFileSync(GUILD_DB_PATH, 'utf-8'));
  return memoryDB!;
}

export function saveGuildDB(db: GuildDB) {
  memoryDB = db;
  fs.writeFileSync(GUILD_DB_PATH, JSON.stringify(db, null, 2));
}

function generateShortId(): string {
  return Math.random().toString(16).substring(2, 6).toUpperCase();
}

export function handleGuild(db: MinigameDB, player: PlayerInventory, playerId: string, playerName: string, args: string[]): { embeds: EmbedBuilder[] } {
  const gdb = loadGuildDB();
  const subcmd = (args[0] || '').toLowerCase();
  
  if (subcmd === 'create') {
    if (player.guildId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu sudah berada di dalam guild! Keluar dari guildmu dulu (`!guild leave`).')] };
    }
    const guildName = args.slice(1).join(' ');
    if (!guildName || guildName.length < 3 || guildName.length > 20) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Nama guild harus antara 3 - 20 karakter! Contoh: `!guild create Dragon Slayers`')] };
    }
    
    // Check if name taken
    for (const g of Object.values(gdb.guilds)) {
      if (g.name.toLowerCase() === guildName.toLowerCase()) {
        return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Nama guild sudah dipakai!')] };
      }
    }
    
    if (player.coins < 50) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Biaya membuat Guild adalah **50 Coin**. Uangmu hanya **${player.coins} Coin**.`)] };
    }
    
    player.coins -= 50;
    const gId = generateShortId();
    gdb.guilds[gId] = {
      id: gId,
      name: guildName,
      level: 1,
      exp: 0,
      treasury: 0,
      members: [{ userId: playerId, name: playerName, role: 'Leader', donated: 0 }],
      bossHp: 10000,
      bossMaxHp: 10000,
      bossLevel: 1
    };
    
    player.guildId = gId;
    saveMinigameDB(db);
    saveGuildDB(gdb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('🏰 Guild Terbentuk!').setDescription(`Selamat! Kamu berhasil mendirikan Guild **${guildName}**!\n\nID Guild kamu: \`${gId}\`\nBagikan ID ini ke temanmu agar mereka bisa bergabung dengan \`!guild join ${gId}\`.`)] };
  }
  
  else if (subcmd === 'info') {
    const gId = player.guildId;
    if (!gId || !gdb.guilds[gId]) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu belum bergabung dengan Guild manapun.\n\nBuat guild dengan `!guild create <nama>` (50 Coin) atau gabung dengan `!guild join <ID>`.')] };
    }
    
    const guild = gdb.guilds[gId];
    const expNeeded = guild.level * 100;
    
    let membersList = '';
    guild.members.forEach(m => {
      let icon = m.role === 'Leader' ? '👑' : (m.role === 'Officer' ? '🛡️' : '👤');
      membersList += `${icon} **${m.name}** - Donasi: ${m.donated} Coin\n`;
    });
    
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`🏰 [${guild.id}] ${guild.name} (Lv. ${guild.level})`)
      .setDescription(`EXP: **${guild.exp} / ${expNeeded}**\nTreasury: **${guild.treasury} Coin**\nAnggota: **${guild.members.length} / ${guild.level * 5 + 5}**\n\n**Daftar Anggota:**\n${membersList}`)
      .addFields(
        { name: '🐉 Guild Boss Status', value: `Lv. ${guild.bossLevel} Boss\nHP: **${guild.bossHp} / ${guild.bossMaxHp}**\n\nKetik \`!guild raid\` untuk menyerang boss bersama-sama!` }
      );
      
    return { embeds: [embed] };
  }
  
  else if (subcmd === 'join') {
    if (player.guildId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu sudah berada di dalam guild!')] };
    }
    const gId = (args[1] || '').toUpperCase();
    if (!gId || !gdb.guilds[gId]) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Guild ID tidak ditemukan. Contoh: `!guild join G123`')] };
    }
    const guild = gdb.guilds[gId];
    const maxMembers = guild.level * 5 + 5;
    if (guild.members.length >= maxMembers) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Guild ini sudah penuh!')] };
    }
    
    guild.members.push({ userId: playerId, name: playerName, role: 'Member', donated: 0 });
    player.guildId = gId;
    saveMinigameDB(db);
    saveGuildDB(gdb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`✅ Kamu telah bergabung dengan Guild **${guild.name}**!`)] };
  }
  
  else if (subcmd === 'leave') {
    if (!player.guildId || !gdb.guilds[player.guildId]) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu tidak sedang berada di guild.')] };
    }
    const gId = player.guildId;
    const guild = gdb.guilds[gId];
    
    const memberIndex = guild.members.findIndex(m => m.userId === playerId);
    if (memberIndex !== -1) {
      const isLeader = guild.members[memberIndex].role === 'Leader';
      guild.members.splice(memberIndex, 1);
      
      if (isLeader) {
        if (guild.members.length > 0) {
          guild.members[0].role = 'Leader';
        } else {
          delete gdb.guilds[gId];
        }
      }
    }
    
    player.guildId = null;
    saveMinigameDB(db);
    saveGuildDB(gdb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`✅ Kamu telah keluar dari guild.`)] };
  }
  
  else if (subcmd === 'donate') {
    if (!player.guildId || !gdb.guilds[player.guildId]) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu belum bergabung dengan guild!')] };
    }
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Masukkan jumlah Coin yang valid! Contoh: `!guild donate 10`')] };
    }
    if (player.coins < amount) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Uangmu tidak cukup!')] };
    }
    
    const guild = gdb.guilds[player.guildId];
    player.coins -= amount;
    guild.treasury += amount;
    guild.exp += amount;
    
    const member = guild.members.find(m => m.userId === playerId);
    if (member) member.donated += amount;
    
    // Level up check
    let expNeeded = guild.level * 100;
    let leveledUp = false;
    while (guild.exp >= expNeeded) {
      guild.exp -= expNeeded;
      guild.level++;
      expNeeded = guild.level * 100;
      leveledUp = true;
    }
    
    saveMinigameDB(db);
    saveGuildDB(gdb);
    
    let msg = `✅ Kamu mendonasikan **${amount} Coin** ke guild.`;
    if (leveledUp) {
      msg += `\n🎉 **GUILD LEVEL UP!** Guild kamu sekarang Level **${guild.level}**! Kapasitas anggota bertambah.`;
    }
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(msg)] };
  }
  
  else if (subcmd === 'raid') {
    if (!player.guildId || !gdb.guilds[player.guildId]) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu belum bergabung dengan guild!')] };
    }
    
    const guild = gdb.guilds[player.guildId];
    if (player.hp <= 10) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('HP kamu terlalu rendah untuk nge-raid Boss! Pulihkan HP di Tavern (`!tavern rest`) dulu.')] };
    }
    
    // Damage calculation based on player weapon and level
    const dmg = (player.weaponLevel * 10) + Math.floor(Math.random() * 50) + 10;
    const hpLoss = Math.floor(Math.random() * 15) + 5;
    
    player.hp = Math.max(0, player.hp - hpLoss);
    guild.bossHp -= dmg;
    
    let msg = `Kamu menyerang Guild Boss dan memberikan **${dmg} Damage**!\nKamu terkena *recoil* sebesar **${hpLoss} HP**.\n\nSisa HP Boss: **${Math.max(0, guild.bossHp)}**`;
    let bossDead = false;
    
    if (guild.bossHp <= 0) {
      bossDead = true;
      const rewardGems = guild.bossLevel * 5000;
      const rewardWls = guild.bossLevel * 2;
      
      msg = `🎉 **GUILD BOSS KALAH!**\nKamu memberikan pukulan terakhir sebesar **${dmg} Damage**!\n\nSeluruh anggota yang aktif raid mendapatkan drop, dan perbendaharaan Guild (Treasury) ditambah **${rewardWls * 5} Coin**.`;
      
      guild.treasury += (rewardWls * 5);
      player.gems += rewardGems;
      player.coins += rewardWls;
      
      // Level up boss for next time
      guild.bossLevel++;
      guild.bossMaxHp = 10000 * guild.bossLevel;
      guild.bossHp = guild.bossMaxHp;
    }
    
    saveMinigameDB(db);
    saveGuildDB(gdb);
    
    return { embeds: [new EmbedBuilder().setColor(bossDead ? COLORS.SUCCESS : COLORS.INFO).setTitle('🐉 Guild Raid').setDescription(msg)] };
  }
  
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('🏰 Guild System')
    .setDescription('Bangun komunitas, kumpulkan kekuatan, dan taklukkan Boss bersama!')
    .addFields(
      { name: '📜 Perintah Dasar', value: '`!guild info` - Lihat status guildmu\n`!guild create <nama>` - Buat guild baru (50 Coin)\n`!guild join <ID>` - Gabung ke guild\n`!guild leave` - Keluar dari guild' },
      { name: '⚔️ Aktivitas Guild', value: '`!guild donate <Coin>` - Donasi Coin untuk menaikkan level Guild (menambah kapasitas member)\n`!guild raid` - Serang Guild Boss (Bisa spam selama HP-mu kuat!)' }
    );
    
  return { embeds: [embed] };
}
