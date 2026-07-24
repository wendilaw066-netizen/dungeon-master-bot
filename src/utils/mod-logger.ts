import { Client, EmbedBuilder, Guild } from 'discord.js';
import { db } from '../database';
import { logger } from '../logger';

export async function logModAction(
  client: Client,
  guild: Guild,
  title: string,
  fields: { name: string; value: string; inline?: boolean }[],
  color = 0xff9900
) {
  const settings = db.getGuildSettings(guild.id);
  const logChannelId = settings.modLogChannelId;

  if (!logChannelId) return;

  try {
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .addFields(fields)
        .setTimestamp();

      await (logChannel as any).send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(`Failed to send log action embed to channel ${logChannelId} in guild ${guild.id}:`, 'ModLog');
    logger.error(error as Error);
  }
}
