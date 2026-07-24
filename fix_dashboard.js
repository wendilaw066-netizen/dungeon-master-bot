const fs = require('fs');

const dashCode = `import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, getPlayer, saveMinigameDB, RARITY_COLORS } from '../minigame';
import { calculatePlayerStats, degradeEquipmentDurability } from './equipment';
import { JOBS } from './jobs';

function formatLog(log: string[]): string {
  if (!log || log.length === 0) return 'Belum ada aktivitas.';
  return log.slice(-3).map(l => '\\u2022 ' + l).join('\\n');
}

export function pushDashboardLog(player: PlayerInventory, msg: string) {
  if (!player.dashboardLog) player.dashboardLog = [];
  player.dashboardLog.push(msg);
  if (player.dashboardLog.length > 5) player.dashboardLog.shift();
}

export function renderDashboard(player: PlayerInventory, userName: string) {
  const stats = calculatePlayerStats(player);
  const job = JOBS[player.job?.class] || JOBS['Novice'];
  
  const titleStr = player.activeTitle ? player.activeTitle + ' ' : '';
  
  let farmStatus = 'Siap Panen!';
  const now = Date.now();
  if (player.lastFarm && now - player.lastFarm < 60000) {
    const readyAt = Math.floor((player.lastFarm + 60000) / 1000);
    farmStatus = 'Menunggu <t:' + readyAt + ':R>';
  }

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle(titleStr + userName + '\\'s Dashboard')
    .setDescription('**Job:** ' + job.name + ' (Lv. ' + player.level + ')\\n**EXP:** ' + player.exp + ' / ' + (player.level * 100))
    .addFields(
      { name: 'HP / Mana', value: '**' + player.hp + ' / ' + stats.maxHp + '**\\n**' + (player.mana || 0) + ' / ' + stats.maxMana + '**', inline: true },
      { name: 'Kekayaan', value: player.gems + ' Gems\\n' + player.wls + ' WLs', inline: true },
      { name: 'Ladang (Farm)', value: farmStatus, inline: false },
      { name: 'Log Aktivitas (Terbaru)', value: formatLog(player.dashboardLog || []), inline: false }
    )
    .setFooter({ text: 'Pity Gacha: ' + (player.gachaPity || 0) + '/10 | Terakhir diperbarui' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dash_farm').setLabel('Farm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dash_dungeon').setLabel('Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('dash_gacha').setLabel('Gacha (500 Gems)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dash_inv').setLabel('Inventory').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Segarkan').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

export function handleDashboardAction(db: any, player: PlayerInventory, action: string, userName: string): any {
  if (action === 'farm') {
    const now = Date.now();
    if (player.lastFarm && now - player.lastFarm < 60000) {
      pushDashboardLog(player, 'Gagal farm: Masih cooldown.');
    } else {
      player.lastFarm = now;
      const gemsEarned = Math.floor(Math.random() * 20) + 10;
      player.gems += gemsEarned;
      player.exp += 15;
      
      let dropMsg = '';
      const roll = Math.random() * 100;
      if (roll < 30) {
        if (!player.materials) player.materials = {};
        player.materials['Wood'] = (player.materials['Wood'] || 0) + 1;
        dropMsg = ' dan mendapat 1x Wood';
      }

      const { progressQuest } = require('./quests');
      progressQuest(player, 'farm', 1);
      degradeEquipmentDurability(player, 1);
      
      pushDashboardLog(player, 'Memanen ' + gemsEarned + ' Gems' + dropMsg + ' (+15 EXP)');
    }
    saveMinigameDB(db);
    return renderDashboard(player, userName);
  }

  if (action === 'gacha') {
    if (player.gems < 500) {
      pushDashboardLog(player, 'Gagal Gacha: Gems tidak cukup!');
    } else {
      player.gems -= 500;
      const roll = Math.floor(Math.random() * 100);
      let dropCategory = 'common';
      
      if (player.gachaPity! >= 10) {
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
      
      pushDashboardLog(player, 'Gacha: Mendapat [' + dropCategory.toUpperCase() + '] ' + itemDrop.name + '!');
    }
    saveMinigameDB(db);
    return renderDashboard(player, userName);
  }

  if (action === 'refresh') {
    pushDashboardLog(player, 'Dashboard disegarkan.');
    saveMinigameDB(db);
    return renderDashboard(player, userName);
  }

  if (action === 'inv') {
    const invStr = player.items.length > 0 ? player.items.join(', ') : 'Kosong';
    let matStr = '';
    if (player.materials) {
      for (const [mName, mCount] of Object.entries(player.materials)) {
        matStr += mName + ': ' + mCount + '\\n';
      }
    }
    if (!matStr) matStr = 'Kosong';

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Inventory ' + userName)
      .addFields(
        { name: 'Equipment (Sedang Dipakai)', value: 'Weapon: ' + (player.equipment.weapon?.name || 'Kosong') + ' (Lv.' + (player.equipment.weapon?.level||0) + ')\\nHelmet: ' + (player.equipment.helmet?.name || 'Kosong') + '\\nArmor: ' + (player.equipment.armor?.name || 'Kosong') + '\\nPet: ' + (player.equipment.pet?.name || 'Kosong') },
        { name: 'Material', value: matStr },
        { name: 'Item Bebas', value: invStr.slice(0, 1000) }
      );
      
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali ke Dashboard').setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
  }

  if (action === 'dungeon') {
    const embed = new EmbedBuilder()
      .setColor('#8B0000')
      .setTitle('Dungeon Entrance')
      .setDescription('Kamu berdiri di depan gerbang dungeon. Di dalamnya terdapat monster berbahaya. Jika kamu mati, kamu bisa kehilangan EXP!\\n\\nApakah kamu siap?');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('dngstart')
        .setLabel('Mulai Pertarungan (Normal)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('bossstart')
        .setLabel('Lawan Boss (Hard)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('dash_refresh')
        .setLabel('Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  return renderDashboard(player, userName);
}
`;
fs.writeFileSync('src/utils/rpg/dashboard.ts', dashCode, 'utf8');
