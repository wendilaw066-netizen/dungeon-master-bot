import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';
import { utilityCommands } from './commands/utility';
import { levelingCommands } from './commands/leveling';
import { moderationCommands } from './commands/moderation';
import { economyCommands } from './commands/economy';
import { gamesCommands } from './commands/games';
import { growtopiaCommands } from './commands/growtopia';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  logger.error('Missing DISCORD_TOKEN or CLIENT_ID in environment variables! Make sure you created a .env file.', 'Deploy');
  process.exit(1);
}

// Consolidate all commands into one array
const commands = [
  ...utilityCommands,
  ...levelingCommands,
  ...moderationCommands,
  ...economyCommands,
  ...gamesCommands,
  ...growtopiaCommands,
].map(command => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`, 'Deploy');

    if (guildId) {
      // Guild-specific registration (instant updates for testing)
      logger.info(`Deploying commands to test guild: ${guildId}`, 'Deploy');
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      ) as any[];
      logger.success(`Successfully reloaded ${data.length} guild application (/) commands.`, 'Deploy');

      // Clear global commands to prevent duplication
      logger.info('Clearing global commands to prevent duplicate commands in the server UI...', 'Deploy');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: [] }
      );
      logger.success('Successfully cleared global commands.', 'Deploy');
    } else {
      // Global registration
      logger.info('No GUILD_ID provided. Deploying commands globally...', 'Deploy');
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      ) as any[];
      logger.success(`Successfully reloaded ${data.length} global application (/) commands.`, 'Deploy');
    }
  } catch (error) {
    logger.error('Failed to register commands:', 'Deploy');
    logger.error(error as Error);
  }
})();
