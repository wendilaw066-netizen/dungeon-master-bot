import { Client, EmbedBuilder } from 'discord.js';
import { db } from '../database';
import { logger } from '../logger';

async function checkAndPostAds(client: Client) {
  const guildsSettings = db.getAllGuilds();
  const now = Date.now();
  for (const settings of guildsSettings) {
    const { guildId, adChannelId, adIntervalMinutes, adTemplate, lastAdPostTimestamp = 0 } = settings;

    if (!adChannelId || !adIntervalMinutes || !adTemplate) {
      continue;
    }

    const intervalMs = adIntervalMinutes * 60 * 1000;
    const elapsed = now - lastAdPostTimestamp;

    if (elapsed < intervalMs) {
      continue;
    }

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.warn(`Guild ${guildId} could not be found or fetched.`, 'Scheduler');
        continue;
      }
      
      const channel = await guild.channels.fetch(adChannelId).catch(() => null);
      if (!channel) {
        logger.warn(`Guild ${guild.name}: Channel ${adChannelId} could not be found or fetched.`, 'Scheduler');
        continue;
      }

      if (!channel.isTextBased()) {
        logger.warn(`Guild ${guild.name}: Channel ${adChannelId} is not a text channel.`, 'Scheduler');
        continue;
      }

      logger.info(`Guild ${guild.name}: Posting scheduled ad to channel #${(channel as any).name}...`, 'Scheduler');

      // Premium Red ad embed without button components
      const embed = new EmbedBuilder()
        .setColor(0xff0000) // Premium Red
        .setDescription(adTemplate)
        .setFooter({ text: 'Enjoy automated advertisements like this one as part of our Membership perks!' });

      await (channel as any).send({ embeds: [embed] });
      logger.success(`Guild ${guild.name}: Automated ad posted successfully.`, 'Scheduler');

      // Update DB timestamp
      db.updateGuildSettings(guildId, { lastAdPostTimestamp: now });
    } catch (error) {
      logger.error(`Error executing scheduled ad post for guild ${guildId}:`, 'Scheduler');
      logger.error(error as Error);
    }
  }
}

export function startAdScheduler(client: Client) {
  logger.info('Starting automated advertising scheduler service...', 'Scheduler');

  // Run with a 5-second delay to let guild caches populate
  setTimeout(() => {
    checkAndPostAds(client).catch((err) => {
      logger.error('Error in initial ad-scheduler check:', 'Scheduler');
      logger.error(err);
    });
  }, 5000);

  // Then check every 60 seconds
  setInterval(() => {
    checkAndPostAds(client).catch((err) => {
      logger.error('Error in scheduled ad-scheduler check:', 'Scheduler');
      logger.error(err);
    });
  }, 60000);
}
