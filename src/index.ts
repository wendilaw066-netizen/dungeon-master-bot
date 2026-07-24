import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';
import readyEvent from './events/ready';
import interactionCreateEvent from './events/interactionCreate';
import messageCreateEvent from './events/messageCreate';
import guildMemberAddEvent from './events/guildMemberAdd';
import { BotEvent } from './types';

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  logger.error('Missing DISCORD_TOKEN in environment variables! Copy .env.example to .env and configure it.', 'Core');
  process.exit(1);
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load events
const events: BotEvent[] = [readyEvent, interactionCreateEvent, messageCreateEvent, guildMemberAddEvent];

for (const event of events) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.debug(`Loaded event handler: ${event.name}`, 'Core');
}

// Global error handlers to prevent bot crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise:', 'System');
  logger.error(reason as Error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', 'System');
  logger.error(error);
});

client.login(token).catch((error) => {
  logger.error('Failed to login to Discord API. Check if your Bot Token in .env is correct.', 'Core');
  logger.error(error as Error);
});

// touch for reload
