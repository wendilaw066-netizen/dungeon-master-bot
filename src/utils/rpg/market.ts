import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';
import { pushDashboardLog } from './dashboard';

export function renderMarketMenu(player: PlayerInventory, userName: string): any {
  const playerWood = player.materials?.['Wood'] || 0;
  const playerIron = player.materials?.['Iron'] || 0;

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('📈 Pasar Bursa Material (Coin Exchange)')
    .setDescription(
      `Beli dan jual material konstruksi kota secara massal menggunakan **World Lock (Coin)** secara langsung!\n\n` +
      `📦 **Paket Transaksi Wood:**\n` +
      `• Beli: **1 Coin** ➡️ mendapatkan **30 Wood**\n` +
      `• Jual: **30 Wood** ➡️ mendapatkan **1 Coin**\n` +
      `└ *Stok Wood Anda:* **${playerWood} unit**\n\n` +
      `🪨 **Paket Transaksi Iron:**\n` +
      `🔸 Beli: **1 Coin** ➡️ mendapatkan **20 Iron**\n` +
      `🔸 Jual: **20 Iron** ➡️ mendapatkan **1 Coin**\n` +
      `🌲 *Stok Iron Anda:* **${playerIron} unit**\n\n` +
      `*Gunakan material ini untuk mempercepat pembangunan gedung di Kota Anda!*`
    )
    .setFooter({ text: 'Transaksi instan menggunakan saldo Coin Anda' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('market_buy_wood').setLabel('Beli 30 Wood (1 Coin)').setEmoji('🪵').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('market_sell_wood').setLabel('Jual 30 Wood (1 Coin)').setEmoji('💸').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('market_buy_iron').setLabel('Beli 20 Iron (1 Coin)').setEmoji('⛏️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('market_sell_iron').setLabel('Jual 20 Iron (1 Coin)').setEmoji('💸').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function handleMarketAction(db: any, player: PlayerInventory, action: string, userName: string): any {
  if (!player.materials) player.materials = {};

  if (action === 'buy_wood') {
    if (player.coins < 1) {
      pushDashboardLog(player, 'Bursa: Gagal beli Wood! Coin tidak cukup.');
    } else {
      player.coins -= 1;
      player.materials['Wood'] = (player.materials['Wood'] || 0) + 30;
      pushDashboardLog(player, '🛒 Bursa: Berhasil membeli 30x Wood seharga 1 Coin!');
    }
    saveMinigameDB(db);
    return renderMarketMenu(player, userName);
  }

  if (action === 'sell_wood') {
    const woodCount = player.materials['Wood'] || 0;
    if (woodCount < 30) {
      pushDashboardLog(player, 'Bursa: Wood Anda tidak cukup untuk dijual! (Butuh minimal 30 Wood)');
    } else {
      player.materials['Wood'] -= 30;
      player.coins += 1;
      pushDashboardLog(player, '💵 Bursa: Berhasil menjual 30x Wood mendapatkan 1 Coin!');
    }
    saveMinigameDB(db);
    return renderMarketMenu(player, userName);
  }

  if (action === 'buy_iron') {
    if (player.coins < 1) {
      pushDashboardLog(player, 'Bursa: Gagal beli Iron! Coin tidak cukup.');
    } else {
      player.coins -= 1;
      player.materials['Iron'] = (player.materials['Iron'] || 0) + 20;
      pushDashboardLog(player, '🛒 Bursa: Berhasil membeli 20x Iron seharga 1 Coin!');
    }
    saveMinigameDB(db);
    return renderMarketMenu(player, userName);
  }

  if (action === 'sell_iron') {
    const ironCount = player.materials['Iron'] || 0;
    if (ironCount < 20) {
      pushDashboardLog(player, 'Bursa: Iron Anda tidak cukup untuk dijual! (Butuh minimal 20 Iron)');
    } else {
      player.materials['Iron'] -= 20;
      player.coins += 1;
      pushDashboardLog(player, '💰 Bursa: Berhasil menjual 20x Iron mendapatkan 1 Coin!');
    }
    saveMinigameDB(db);
    return renderMarketMenu(player, userName);
  }

  return renderMarketMenu(player, userName);
}
