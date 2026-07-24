const fs = require('fs');

const dashCode = `import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { calculatePlayerStats, degradeEquipmentDurability } from './equipment';
import { JOBS } from './jobs';

const DIFFICULTIES = ['Normal', 'Hard', 'Nightmare', 'Hell', 'Torment'];

function hpBar(cur: number, max: number, len = 10): string {
  const pct = Math.max(0, Math.min(1, cur / Math.max(1, max)));
  const filled = Math.round(pct * len);
  return '[' + '#'.repeat(filled) + '-'.repeat(len - filled) + ']';
}

function formatLog(log: string[]): string {
  if (!log || log.length === 0) return 'Belum ada aktivitas.';
  return log.slice(-4).map(l => '\\u2022 ' + l).join('\\n');
}

export function pushDashboardLog(player: PlayerInventory, msg: string) {
  if (!player.dashboardLog) player.dashboardLog = [];
  player.dashboardLog.push(msg);
  if (player.dashboardLog.length > 6) player.dashboardLog.shift();
}

export function renderDashboard(player: PlayerInventory, userName: string) {
  const stats = calculatePlayerStats(player);
  const job = JOBS[player.job?.class as keyof typeof JOBS] || JOBS['Novice'];
  const titleStr = player.activeTitle ? '[' + player.activeTitle + '] ' : '';
  const pet = player.equipment?.pet?.name || 'Tidak ada';
  const weapon = player.equipment?.weapon?.name || 'Kosong';
  const weaponLv = player.equipment?.weapon?.level || 0;
  const weaponDur = player.equipment?.weapon?.durability ?? 100;

  // Farm cooldown
  let farmStatus = 'Siap Panen!';
  const now = Date.now();
  if (player.lastFarmTime && now - player.lastFarmTime < 60000) {
    const readyAt = Math.floor((player.lastFarmTime + 60000) / 1000);
    farmStatus = 'Menunggu <t:' + readyAt + ':R>';
  }

  // Dungeon progress
  const dp = player.dungeonProgress;
  const dpStr = DIFFICULTIES[dp?.difficulty ?? 0] + ' Ch.' + (dp?.chapter ?? 1) + ' Stage ' + (dp?.stage ?? 1);

  // HP bar visual
  const hpBarStr = hpBar(player.hp, stats.maxHp, 12);
  const hpStr = player.hp + ' / ' + stats.maxHp + ' ' + hpBarStr;

  // Daily Quest summary
  let questStr = 'Tidak ada quest aktif.';
  if (player.dailyQuests && player.dailyQuests.length > 0) {
    questStr = player.dailyQuests.map(q => {
      const icon = q.completed ? 'V' : '-';
      return '[' + icon + '] ' + q.description + ' (' + q.progress + '/' + q.target + ')';
    }).join('\\n');
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(titleStr + userName + "'s Dashboard")
    .setDescription(
      '**Job:** ' + job.className + ' Tier ' + job.tier + ' (' + job.category + ')' +
      '\\n**Senjata:** ' + weapon + ' +' + weaponLv + '  (Durability: ' + weaponDur + '%)' +
      '\\n**Pet:** ' + pet
    )
    .addFields(
      {
        name: 'Stats',
        value: 'HP: **' + hpStr + '**\\nMana: **' + (player.mana || 0) + ' / ' + stats.maxMana + '**\\nATK: **' + stats.attack + '**',
        inline: true
      },
      {
        name: 'Kekayaan',
        value: 'Gems: **' + player.gems + '**\\nWL: **' + player.wls + '**\\nDL: **' + player.dls + '**',
        inline: true
      },
      {
        name: 'Dungeon Progress',
        value: '**' + dpStr + '**',
        inline: true
      },
      {
        name: 'Ladang (Farm Cooldown)',
        value: farmStatus,
        inline: false
      },
      {
        name: 'Daily Quest',
        value: questStr.slice(0, 400),
        inline: false
      },
      {
        name: 'Log Aktivitas',
        value: formatLog(player.dashboardLog || []),
        inline: false
      }
    )
    .setFooter({ text: 'Pity Gacha: ' + (player.gachaPity || 0) + '/10  |  !menu untuk refresh' })
    .setTimestamp();

  // Row 1: Main actions
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dash_farm').setLabel('Farm').setEmoji('\\ud83c\\udf3e').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dash_dungeon').setLabel('Dungeon').setEmoji('\\u2694\\ufe0f').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('dash_boss').setLabel('Boss').setEmoji('\\ud83d\\udc7a').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('dash_gacha').setLabel('Gacha (500G)').setEmoji('\\ud83c\\udfb0').setStyle(ButtonStyle.Primary)
  );

  // Row 2: Info & utility
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dash_inv').setLabel('Inventory').setEmoji('\\ud83c\\udf92').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_quest').setLabel('Daily Quest').setEmoji('\\ud83d\\udccb').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_stat').setLabel('Full Stats').setEmoji('\\ud83d\\udcca').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Refresh').setEmoji('\\ud83d\\udd04').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

export function handleDashboardAction(db: any, player: PlayerInventory, action: string, userName: string): any {
  // ==================
  // FARM
  // ==================
  if (action === 'farm') {
    const now = Date.now();
    if (player.lastFarmTime && now - player.lastFarmTime < 60000) {
      pushDashboardLog(player, 'Farm gagal: Masih cooldown!');
    } else {
      player.lastFarmTime = now;
      const gemsEarned = Math.floor(Math.random() * 25) + 10 + (player.pickaxeLevel || 0) * 2;
      player.gems += gemsEarned;

      let dropMsg = '';
      const roll = Math.random() * 100;
      if (roll < 30) {
        if (!player.materials) player.materials = {};
        player.materials['Wood'] = (player.materials['Wood'] || 0) + 1;
        dropMsg = ' +1 Wood';
      } else if (roll < 40) {
        if (!player.materials) player.materials = {};
        player.materials['Iron Ore'] = (player.materials['Iron Ore'] || 0) + 1;
        dropMsg = ' +1 Iron Ore';
      }

      const { progressQuest } = require('./quests');
      progressQuest(player, 'farm', 1);
      degradeEquipmentDurability(player, 1);

      pushDashboardLog(player, 'Farm: +' + gemsEarned + ' Gems' + dropMsg);
    }
    saveMinigameDB(db);
    return renderDashboard(player, userName);
  }

  // ==================
  // GACHA
  // ==================
  if (action === 'gacha') {
    if (player.gems < 500) {
      pushDashboardLog(player, 'Gacha gagal: Gems tidak cukup!');
    } else {
      player.gems -= 500;
      const roll = Math.floor(Math.random() * 100);
      let dropCategory = 'common';

      if ((player.gachaPity || 0) >= 10) {
        dropCategory = roll < 20 ? 'legendary' : 'epic';
        player.gachaPity = 0;
      } else {
        if (roll < 5) dropCategory = 'legendary';
        else if (roll < 20) dropCategory = 'epic';
        else if (roll < 50) dropCategory = 'rare';
      }

      const itemPools = require('./items').ITEMS;
      const pool = itemPools[dropCategory as keyof typeof itemPools];
      const itemDrop = pool[Math.floor(Math.random() * pool.length)];
      player.items.push(itemDrop.name);

      if (dropCategory === 'epic' || dropCategory === 'legendary') {
        player.gachaPity = 0;
      } else {
        player.gachaPity = (player.gachaPity || 0) + 1;
      }

      pushDashboardLog(player, 'Gacha: [' + dropCategory.toUpperCase() + '] ' + itemDrop.name);
    }
    saveMinigameDB(db);
    return renderDashboard(player, userName);
  }

  // ==================
  // DUNGEON ENTRANCE
  // ==================
  if (action === 'dungeon') {
    const dp = player.dungeonProgress;
    const curDiff = DIFFICULTIES[dp?.difficulty ?? 0];
    const curProg = curDiff + ' Ch.' + (dp?.chapter ?? 1) + ' Stage ' + (dp?.stage ?? 1);

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle('Dungeon Entrance')
      .setDescription(
        'Kamu berdiri di depan gerbang dungeon yang gelap.\\n\\n' +
        '**Progress Saat Ini:** ' + curProg + '\\n' +
        '**HP Kamu:** ' + player.hp + ' / ' + player.maxHp + '\\n\\n' +
        'Tekan tombol di bawah untuk mulai!'
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dngstart').setLabel('Masuk Dungeon').setEmoji('\\u2694\\ufe0f').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
  }

  // ==================
  // BOSS ENTRANCE
  // ==================
  if (action === 'boss') {
    const dp = player.dungeonProgress;
    const curDiff = DIFFICULTIES[dp?.difficulty ?? 0];

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle('Boss Battle')
      .setDescription(
        'Kamu menuju ke ruang Boss Stage 10!\\n\\n' +
        '**Difficulty:** ' + curDiff + '\\n' +
        '**HP Kamu:** ' + player.hp + ' / ' + player.maxHp + '\\n\\n' +
        'Boss sangat kuat. Pastikan HP penuh sebelum bertarung!'
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('bossstart').setLabel('Lawan Boss').setEmoji('\\ud83d\\udc7a').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
  }

  // ==================
  // INVENTORY (LENGKAP)
  // ==================
  if (action === 'inv') {
    const eq = player.equipment;
    const slots = [
      ['Weapon', eq.weapon],
      ['Shield', eq.shield],
      ['Helmet', eq.helmet],
      ['Armor', eq.armor],
      ['Gloves', eq.gloves],
      ['Boots', eq.boots],
      ['Necklace', eq.necklace],
      ['Ring', eq.ring],
      ['Pet', eq.pet],
      ['Artifact', eq.artifact],
    ] as const;

    const eqLines = slots.map(([slot, data]) => {
      if (data?.name) {
        const lv = data.level ? ' +' + data.level : '';
        const dur = ' (Dur: ' + (data.durability ?? 100) + '%)';
        return slot + ': **' + data.name + lv + '**' + dur;
      }
      return slot + ': -';
    }).join('\\n');

    let matStr = '';
    if (player.materials && Object.keys(player.materials).length > 0) {
      for (const [mName, mCount] of Object.entries(player.materials)) {
        matStr += mName + ': ' + mCount + '\\n';
      }
    } else {
      matStr = 'Kosong';
    }

    const invItems = player.items.length > 0 ? player.items.slice(0, 20).join('\\n') + (player.items.length > 20 ? '\\n...' : '') : 'Kosong';

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Inventory ' + userName)
      .addFields(
        { name: 'Equipment Terpasang', value: eqLines, inline: false },
        { name: 'Material & Bahan Crafting', value: matStr.slice(0, 500), inline: true },
        { name: 'Item (' + player.items.length + ')', value: invItems.slice(0, 500), inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali ke Dashboard').setEmoji('\\ud83d\\udd19').setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
  }

  // ==================
  // DAILY QUEST DETAILS
  // ==================
  if (action === 'quest') {
    let questDetail = 'Tidak ada quest aktif.\\nKetik `!daily` untuk mendapatkan quest harian baru!';
    if (player.dailyQuests && player.dailyQuests.length > 0) {
      questDetail = player.dailyQuests.map((q, i) => {
        const status = q.completed ? 'SELESAI' : q.progress + '/' + q.target;
        return (i + 1) + '. ' + q.description + ' [' + status + ']';
      }).join('\\n');
    }

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('Daily Quest ' + userName)
      .setDescription(questDetail)
      .setFooter({ text: 'Ketik !daily claim jika semua selesai untuk mendapatkan hadiah!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali ke Dashboard').setEmoji('\\ud83d\\udd19').setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
  }

  // ==================
  // FULL STATS
  // ==================
  if (action === 'stat') {
    const stats = calculatePlayerStats(player);
    const job = JOBS[player.job?.class as keyof typeof JOBS] || JOBS['Novice'];
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('Full Stats - ' + userName)
      .addFields(
        { name: 'Job', value: job.className + ' Tier ' + job.tier + ' (' + job.category + ')', inline: false },
        { name: 'HP', value: player.hp + ' / ' + stats.maxHp, inline: true },
        { name: 'Mana', value: (player.mana || 0) + ' / ' + stats.maxMana, inline: true },
        { name: 'ATK', value: '' + stats.attack, inline: true },
        { name: 'DEF', value: '' + (stats.defense || 0), inline: true },
        { name: 'Arena Rating (ELO)', value: '' + (player.arenaRating || 1000), inline: true },
        { name: 'PvP W/L', value: (player.pvpWins || 0) + ' / ' + (player.pvpLosses || 0), inline: true },
        { name: 'Gems', value: '' + player.gems, inline: true },
        { name: 'WL / DL', value: player.wls + ' / ' + player.dls, inline: true },
        { name: 'Title Aktif', value: player.activeTitle || 'Tidak ada', inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali ke Dashboard').setEmoji('\\ud83d\\udd19').setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
  }

  // ==================
  // REFRESH / DEFAULT
  // ==================
  saveMinigameDB(db);
  return renderDashboard(player, userName);
}
`;
fs.writeFileSync('src/utils/rpg/dashboard.ts', dashCode, 'utf8');
console.log('dashboard.ts rewritten');
