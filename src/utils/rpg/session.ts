import { Client, EmbedBuilder } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';

export async function closeOldSession(client: Client, player: PlayerInventory, db: any) {
  if (player.activeSession && player.activeSession.channelId && player.activeSession.messageId) {
    try {
      const channel = await client.channels.fetch(player.activeSession.channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const oldMsg = await (channel as any).messages.fetch(player.activeSession.messageId).catch(() => null);
        if (oldMsg) {
          // Try deleting old dashboard message so ONLY 1 dashboard exists in chat history!
          await oldMsg.delete().catch(async () => {
            // Fallback if message cannot be deleted: strip components and gray out embed
            if (oldMsg.embeds && oldMsg.embeds.length > 0) {
              const origTitle = oldMsg.embeds[0].title || 'Kerajaan';
              const cleanTitle = origTitle.includes('[SESI DITUTUP]') ? origTitle : `🔒 [SESI DITUTUP] ${origTitle}`;

              const oldEmbed = EmbedBuilder.from(oldMsg.embeds[0])
                .setColor(0x808080)
                .setTitle(cleanTitle)
                .setDescription(`🔒 **Sesi dashboard lama ini telah ditutup.**\nSilakan gunakan pesan dashboard terbaru Anda untuk melanjutkan permainan!`);

              await oldMsg.edit({ embeds: [oldEmbed], components: [] }).catch(() => null);
            }
          });
        }
      }
    } catch (err) {
      // Ignore channel or message fetch error
    }
  }
}

export function registerNewSession(player: PlayerInventory, messageId: string, channelId: string, db: any) {
  player.activeSession = { channelId, messageId };
  saveMinigameDB(db);
}
