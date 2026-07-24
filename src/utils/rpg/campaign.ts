import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';
import { pushDashboardLog } from './dashboard';

// Procedural Deterministic Campaign Generator (1000+ Chapters)
// We generate title, NPC, dialog, types (Combat, Trap, Mystery) and rewards dynamically based on chapter ID.

const NPCS = ['Elder Arthur', 'Commander Vane', 'High Priestess Elaria', 'Alchemist Royce', 'Rogue Kael', 'Wizard Gideon', 'Lady Genevieve', 'Iron-Smith Thorgar', 'Oracle Lyra', 'Baron Valerius', 'Dark-Elf Syra', 'Demon Hunter Jarek'];

const NOUNS = ['Mahkota', 'Benteng', 'Cincin', 'Pedang', 'Kitab', 'Kunci', 'Pusaka', 'Kristal', 'Rune', 'Gerbang', 'Daratan', 'Hutan', 'Kuil', 'Makam', 'Menara', 'Lembah', 'Samudra', 'Istana', 'Pasukan', 'Benua'];
const ADJECTIVES = ['Terlarang', 'Maut', 'Kuno', 'Kekosongan', 'Darah', 'Dewa', 'Kegelapan', 'Cahaya', 'Bintang', 'Es', 'Bara', 'Shadow', 'Abadi', 'Legenda', 'Misteri', 'Reruntuhan', 'Kiamat', 'Keemasan', 'Surgawi', 'Badai'];

const PRE_TITLES = ['Bab', 'Kisah', 'Langkah', 'Ziarah', 'Penaklukan', 'Misteri', 'Ekspedisi', 'Pertempuran', 'Legenda', 'Tragedi'];

export interface ChapterRequirement {
  type: 'job' | 'shield' | 'wl' | 'gems' | 'morale' | 'farm_lvl' | 'dungeon_lvl' | 'none';
  value: any;
  desc: string;
}

export interface CampaignChapter {
  id: number;
  title: string;
  npc: string;
  dialogue: string;
  type: 'combat' | 'trap' | 'mystery';
  choiceA: { text: string; detail: string; req?: ChapterRequirement };
  choiceB: { text: string; detail: string; req?: ChapterRequirement };
}

// Simple deterministic hash based on chapter ID to keep values consistent for the same player/chapter
function seedRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function checkOptionRequirement(player: PlayerInventory, req?: ChapterRequirement): { success: boolean; errorMsg?: string } {
  if (!req || req.type === 'none') return { success: true };
  const stats = require('./equipment').calculatePlayerStats(player);

  switch (req.type) {
    case 'job':
      const isNovice = (player.job?.class || 'Novice') === 'Novice';
      if (req.value === 'any' && isNovice) {
        return { success: false, errorMsg: 'Memerlukan spesialisasi Job (Bukan Novice)!' };
      }
      if (req.value !== 'any' && player.job?.class !== req.value) {
        return { success: false, errorMsg: `Hanya bisa diambil oleh kelas [${req.value}]!` };
      }
      break;
    case 'shield':
      const shield = player.equipment?.shield?.name;
      if (!shield) {
        return { success: false, errorMsg: 'Memerlukan Tameng (Shield) terpasang di Equipment!' };
      }
      break;
    case 'wl':
      if ((player.coins || 0) < req.value) {
        return { success: false, errorMsg: `Memerlukan minimal ${req.value} Coin di dompet!` };
      }
      break;
    case 'gems':
      if ((player.gems || 0) < req.value) {
        return { success: false, errorMsg: `Memerlukan minimal ${req.value.toLocaleString()} Gems!` };
      }
      break;
    case 'morale':
      const morale = player.town?.morale ?? 100;
      if (morale < req.value) {
        return { success: false, errorMsg: `Memerlukan minimal ${req.value}% Morale Kota!` };
      }
      break;
    case 'farm_lvl':
      if ((player.farmLevel || 1) < req.value) {
        return { success: false, errorMsg: `Memerlukan Level Pertanian (Farm Lv) minimal ${req.value}!` };
      }
      break;
    case 'dungeon_lvl':
      if ((player.dungeonLevel || 1) < req.value) {
        return { success: false, errorMsg: `Memerlukan Level Dungeon minimal ${req.value}!` };
      }
      break;
  }
  return { success: true };
}

export function getCampaignChapter(id: number): CampaignChapter {
  const r1 = seedRandom(id * 11);
  const r2 = seedRandom(id * 17);
  const r3 = seedRandom(id * 23);
  const r4 = seedRandom(id * 29);

  const pre = PRE_TITLES[Math.floor(r1 * PRE_TITLES.length)];
  const noun = NOUNS[Math.floor(r2 * NOUNS.length)];
  const adj = ADJECTIVES[Math.floor(r3 * ADJECTIVES.length)];
  const npc = NPCS[Math.floor(r4 * NPCS.length)];

  const types: ('combat' | 'trap' | 'mystery')[] = ['combat', 'trap', 'mystery'];
  const type = types[id % 3];

  let dialogue = '';
  let choiceA: CampaignChapter['choiceA'] = { text: '', detail: '' };
  let choiceB: CampaignChapter['choiceB'] = { text: '', detail: '' };

  if (type === 'combat') {
    dialogue = `"Awas! Seekor binatang buas purba yang korup menghadang jalan kita! Pedang kita hampir tidak mempan pada kulitnya yang keras!"`;
    
    // Combat Requirements
    const reqJob = id > 100 ? (r1 > 0.5 ? 'Knight' : 'Mage') : 'any';
    choiceA = {
      text: '⚔️ Serang Langsung (Butuh ATK)',
      detail: 'Uji kekuatan! Menang mendapat Coin besar & Material. Kalah kehilangan 25 HP.',
      req: {
        type: 'job',
        value: reqJob,
        desc: reqJob === 'any' ? '🛡️ Butuh spesialisasi Job (Bukan Novice)' : `🧙 Butuh spesialisasi Job: ${reqJob}`
      }
    };
    choiceB = {
      text: '💨 Taktik Menghindar',
      detail: 'Menghindar dengan aman. Mendapat sedikit Gems dari buah hutan di sekitar.',
      req: { type: 'none', value: null, desc: 'Bebas Syarat' }
    };
  } else if (type === 'trap') {
    dialogue = `"Klik! Lantai yang kita injak ambles ke bawah! Gas beracun dan anak panah meluncur dengan cepat ke arah kita!"`;
    choiceA = {
      text: '🏃 Terjang Maju / Lompat',
      detail: '70% peluang sukses meloloskan diri (Hadiah Gems). Gagal mengurangi 35 HP.',
      req: {
        type: 'dungeon_lvl',
        value: Math.min(20, Math.floor(id / 100) + 2),
        desc: `🎯 Butuh Dungeon Level ${Math.min(20, Math.floor(id / 100) + 2)}`
      }
    };
    choiceB = {
      text: '🛡️ Bertahan Dengan Shield',
      detail: 'Gunakan ketahanan perisaimu. Aman, tapi durabilitas tamengmu akan berkurang.',
      req: {
        type: 'shield',
        value: true,
        desc: '🛡️ Harus memasang Tameng (Shield)'
      }
    };
  } else {
    dialogue = `"Lihat di altar kuil itu! Sebuah peti emas misterius bersinar redup. Terkunci rapat oleh segel mantra sihir kuno."`;
    choiceA = {
      text: '🗝️ Buka Paksa Peti (Gacha Nasib)',
      detail: 'Bisa mendapat Equipment Langka/Gems melimpah, atau justru terkena kutukan.',
      req: {
        type: 'wl',
        value: Math.max(1, Math.floor(id / 150)),
        desc: `🪙 Butuh Modal: ${Math.max(1, Math.floor(id / 150))} Coin`
      }
    };
    choiceB = {
      text: '🏛️ Serahkan ke Desa',
      detail: 'Meningkatkan Morale kota penduduk (+15% Morale) & mendapat bonus pajak Gems.',
      req: {
        type: 'morale',
        value: 50,
        desc: '😊 Butuh minimal 50% Morale Kota'
      }
    };
  }

  return {
    id,
    title: `${pre} ${id}: ${noun} ${adj}`,
    npc,
    dialogue,
    type,
    choiceA,
    choiceB
  };
}

export function renderCampaignMenu(player: PlayerInventory, userName: string): any {
  if (!player.storyProgress) player.storyProgress = 1;
  const currentChapter = getCampaignChapter(player.storyProgress);

  const maxChapters = 1000;
  const isCompleted = player.storyProgress > maxChapters;

  if (isCompleted) {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('📜 Misi Cerita Utama: MAKSIMAL!')
      .setDescription(`👑 **Selamat, ${userName}!** Anda telah menyelesaikan seluruh 1.000 Bab Misi Cerita Utama dan diakui sebagai Penguasa Legendaris Abadi!`)
      .setFooter({ text: 'Ketik !menu untuk kembali' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali ke Menu').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [row] };
  }

  const typeEmojis = { combat: '👹 COMBAT', trap: '⚠️ TRAP', mystery: '🔮 MYSTERY' };

  // Check requirements for locking buttons
  const reqA = checkOptionRequirement(player, currentChapter.choiceA.req);
  const reqB = checkOptionRequirement(player, currentChapter.choiceB.req);

  const titleLockA = reqA.success ? '' : ' 🔒 [TERKUNCI]';
  const titleLockB = reqB.success ? '' : ' 🔒 [TERKUNCI]';

  const descA = currentChapter.choiceA.req && currentChapter.choiceA.req.type !== 'none'
    ? `${currentChapter.choiceA.detail}\n*(Syarat: ${currentChapter.choiceA.req.desc})*`
    : currentChapter.choiceA.detail;

  const descB = currentChapter.choiceB.req && currentChapter.choiceB.req.type !== 'none'
    ? `${currentChapter.choiceB.detail}\n*(Syarat: ${currentChapter.choiceB.req.desc})*`
    : currentChapter.choiceB.detail;

  const embed = new EmbedBuilder()
    .setColor(currentChapter.type === 'combat' ? 0xC0392B : (currentChapter.type === 'trap' ? 0xD35400 : 0x8E44AD))
    .setTitle(`📜 ${currentChapter.title} — [${typeEmojis[currentChapter.type]}]`)
    .setDescription(
      `**NPC:** 🗣️ *${currentChapter.npc}*\n\n` +
      `> *${currentChapter.dialogue}*\n\n` +
      `Status Kamu: ❤️ **HP:** \`${player.hp}/${player.maxHp || 100}\`\n\n` +
      `Pilih alur cerita dan tindakan yang akan diambil untuk Bab ini:`
    )
    .addFields(
      { name: `1️⃣ Opsi A${titleLockA}`, value: `**${currentChapter.choiceA.text}**\n└ *${descA}*`, inline: false },
      { name: `2️⃣ Opsi B${titleLockB}`, value: `**${currentChapter.choiceB.text}**\n└ *${descB}*`, inline: false },
    )
    .setFooter({ text: `Bab ${player.storyProgress} dari ${maxChapters}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('camp_choice_a')
      .setLabel(reqA.success ? 'Pilih Opsi 1' : 'Terkunci 🔒')
      .setStyle(reqA.success ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(player.hp <= 0 || !reqA.success),
    new ButtonBuilder()
      .setCustomId('camp_choice_b')
      .setLabel(reqB.success ? 'Pilih Opsi 2' : 'Terkunci 🔒')
      .setStyle(reqB.success ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(player.hp <= 0 || !reqB.success),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function handleCampaignAction(db: any, player: PlayerInventory, action: string, userName: string): any {
  if (!player.storyProgress) player.storyProgress = 1;
  const currentChapter = getCampaignChapter(player.storyProgress);
  const { calculatePlayerStats, degradeEquipmentDurability } = require('./equipment');
  const stats = calculatePlayerStats(player);

  if (player.hp <= 0) {
    pushDashboardLog(player, 'Gagal lanjut cerita: HP kamu 0! Istirahat dulu di Tavern.');
    return renderCampaignMenu(player, userName);
  }

  // Validate choice requirements before action
  if (action === 'choice_a') {
    const check = checkOptionRequirement(player, currentChapter.choiceA.req);
    if (!check.success) {
      pushDashboardLog(player, `🔒 Pilihan A terkunci: ${check.errorMsg}`);
      return renderCampaignMenu(player, userName);
    }
  } else {
    const check = checkOptionRequirement(player, currentChapter.choiceB.req);
    if (!check.success) {
      pushDashboardLog(player, `🔒 Pilihan B terkunci: ${check.errorMsg}`);
      return renderCampaignMenu(player, userName);
    }
  }

  const id = player.storyProgress;
  const rRoll = seedRandom(id * 41);

  if (action === 'choice_a') {
    if (currentChapter.type === 'combat') {
      // Combat A: Test player ATK vs required monster power
      const reqPower = 20 + Math.floor(id * 0.8);
      if (stats.attack >= reqPower) {
        const rewardWl = 3 + Math.floor(id / 60);
        player.coins += rewardWl;
        
        if (!player.materials) player.materials = {};
        const mat = rRoll > 0.5 ? 'Iron Ore' : 'Wood';
        player.materials[mat] = (player.materials[mat] || 0) + 3;

        player.storyProgress += 1;
        pushDashboardLog(player, `⚔️ Menang Tarung Bab ${id}! Mengalahkan monster (+${rewardWl} Coin & +3 ${mat}).`);
      } else {
        player.hp = Math.max(1, player.hp - 25); // Don't instantly die, drop to 1
        pushDashboardLog(player, `❌ Kalah Tarung Bab ${id}! Senjatamu kurang tajam (HP berkurang 25).`);
      }
    } else if (currentChapter.type === 'trap') {
      // Trap A: 70% success chance
      if (rRoll < 0.70) {
        const gemsGained = 1500 + (id * 25);
        player.gems += gemsGained;
        player.storyProgress += 1;
        pushDashboardLog(player, `🏃 Berhasil melompati jebakan Bab ${id}! Menemukan kantong Gems (+${gemsGained.toLocaleString()}).`);
      } else {
        player.hp = Math.max(1, player.hp - 35);
        pushDashboardLog(player, `💥 Terkena jebakan Bab ${id}! Terperosok ke duri beracun (HP -35).`);
      }
    } else {
      // Mystery A: Mystery Chest Roll
      const lootRoll = seedRandom(id * 79);
      
      // Deduct cost requirement
      if (currentChapter.choiceA.req?.type === 'wl') {
        player.coins = Math.max(0, player.coins - currentChapter.choiceA.req.value);
      }

      if (lootRoll < 0.15) {
        // Legendary luck (15%): get a cool Rare/Epic gear item name directly in items bag
        const lootItems = ['Holy Amulet', 'Titanium Armor', 'Shadow Katana', 'Frost Shield', 'Excalibur'];
        const rewardItem = lootItems[Math.floor(lootRoll * 10) % lootItems.length];
        player.items.push(rewardItem);
        player.storyProgress += 1;
        pushDashboardLog(player, `🔮 Harta Karun Bab ${id}! Peti berisi item langka: **${rewardItem}**!`);
      } else if (lootRoll < 0.60) {
        // Average luck (45%): get Coins
        const wl = 10 + Math.floor(id / 20);
        player.coins += wl;
        player.storyProgress += 1;
        pushDashboardLog(player, `🔮 Harta Karun Bab ${id}! Peti berisi tumpukan kunci emas (+${wl} Coin).`);
      } else {
        // Bad luck: Curse trap
        player.hp = Math.max(1, player.hp - 20);
        pushDashboardLog(player, `☠️ Peti Terkutuk Bab ${id}! Gas beracun menyembur saat dibuka (HP -20).`);
        player.storyProgress += 1; // still progress anyway
      }
    }
  } else {
    // Choice B: Safer options
    if (currentChapter.type === 'combat') {
      const gems = 800 + Math.floor(id * 10);
      player.gems += gems;
      player.storyProgress += 1;
      pushDashboardLog(player, `💨 Menghindar Bab ${id}: Memilih jalan aman sambil memetik buah energi (+${gems} Gems).`);
    } else if (currentChapter.type === 'trap') {
      degradeEquipmentDurability(player, 10);
      player.storyProgress += 1;
      pushDashboardLog(player, `🛡️ Menahan Jebakan Bab ${id}: Berlindung di balik tameng (Durabilitas Gear -10%, HP Aman).`);
    } else {
      if (player.town) {
        player.town.morale = Math.min(100, (player.town.morale || 100) + 15);
      }
      const taxGems = 1200 + (id * 15);
      player.gems += taxGems;
      player.storyProgress += 1;
      pushDashboardLog(player, `🏛️ Donasi Peti Bab ${id}: Morale kota +15%, penduduk memberikan pajak Gems (+${taxGems.toLocaleString()}).`);
    }
  }

  saveMinigameDB(db);
  return renderCampaignMenu(player, userName);
}
