import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';
import { pushDashboardLog } from './dashboard';

export function renderTradeMenu(player: PlayerInventory, userName: string): any {
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🤝 Jendela Perdagangan Langsung (P2P Trade Window)')
    .setDescription(
      `Tukarkan Gems & World Locks secara instan dengan sesama pemain di server!\n\n` +
      `**Saldo Kamu:**\n` +
      `• 💠 Gems: **${player.gems.toLocaleString()}**\n` +
      `• 🔒 World Locks (Coin): **${player.coins}**\n\n` +
      `*Pilih opsi di bawah untuk mengirim suplai perdagangan:*`
    )
    .addFields(
      { name: '💰 Transfer Coin ke Pemain Lain', value: 'Kirim saldo Coin secara langsung', inline: true },
      { name: '💎 Conversion Fast Trade', value: 'Tukar 2.000 Gems ➡️ 1 Coin', inline: true },
    )
    .setFooter({ text: 'Sistem Perdagangan Aman & Instan' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('trade_convert_wl').setLabel('Tukar 2.000 Gems ➡️ 1 Coin').setEmoji('💎').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function handleTradeAction(db: any, player: PlayerInventory, action: string, userName: string): any {
  if (action === 'convert_wl') {
    if (player.gems < 2000) {
      pushDashboardLog(player, 'Trade gagal: Gems tidak cukup! (butuh 2.000 Gems)');
    } else {
      player.gems -= 2000;
      player.coins += 1;
      pushDashboardLog(player, '🤝 Fast Trade: Menukar 2.000 Gems ➡️ +1 Coin!');
    }
    saveMinigameDB(db);
    return renderTradeMenu(player, userName);
  }

  return renderTradeMenu(player, userName);
}
