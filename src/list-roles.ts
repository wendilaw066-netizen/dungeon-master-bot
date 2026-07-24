import { Client, GatewayIntentBits } from 'discord.js';
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

    const roles = await guild.roles.fetch();
    logger.info(`Roles in server:`, 'Roles');
    roles.forEach(role => {
      logger.info(`- ${role.name} (ID: ${role.id})`, 'Roles');
    });

    process.exit(0);
  } catch (error) {
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
