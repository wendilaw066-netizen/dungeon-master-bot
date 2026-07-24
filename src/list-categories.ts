import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = '1419848896762613921';

if (!token) {
  logger.error('Missing token!');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.error('Guild not found.');
      process.exit(1);
    }

    const channels = await guild.channels.fetch();
    logger.info(`Categories in server:`, 'Channels');
    channels.forEach(channel => {
      if (channel && channel.type === ChannelType.GuildCategory) {
        logger.info(`Category: "${channel.name}" (ID: ${channel.id})`, 'Channels');
      }
    });

    process.exit(0);
  } catch (error) {
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
