import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  logger.error('Missing credentials!', 'Debug');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info('Fetching registered commands...', 'Debug');

    const globalCommands = await rest.get(Routes.applicationCommands(clientId)) as any[];
    logger.info(`Found ${globalCommands.length} GLOBAL commands in Discord's database.`, 'Debug');
    if (globalCommands.length > 0) {
      logger.info('Global commands list: ' + globalCommands.map(c => `/${c.name}`).join(', '), 'Debug');
    }

    if (guildId) {
      const guildCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId)) as any[];
      logger.info(`Found ${guildCommands.length} GUILD commands for guild ${guildId} in Discord's database.`, 'Debug');
      if (guildCommands.length > 0) {
        logger.info('Guild commands list: ' + guildCommands.map(c => `/${c.name}`).join(', '), 'Debug');
      }
    }
  } catch (error) {
    logger.error('Error fetching commands:', 'Debug');
    logger.error(error as Error);
  }
})();
