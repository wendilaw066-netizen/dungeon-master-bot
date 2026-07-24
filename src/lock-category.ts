import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = '1419848896762613921';
const categoryId = '1419848898293268484'; // ID for "✧━━━✧ GUILD AREA ✧━━━✧"
const guildMemberRoleId = '1527947522813989097'; // ID for "Guild Member" role

if (!token) {
  logger.error('Missing DISCORD_TOKEN environment variable!', 'Setup');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  try {
    logger.info('Connected to Discord. Setting up category permissions...', 'Setup');

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.error(`Guild ${guildId} not found!`, 'Setup');
      process.exit(1);
    }

    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category) {
      logger.error(`Category ${categoryId} not found!`, 'Setup');
      process.exit(1);
    }

    logger.info(`Configuring category "${category.name}" to lock for everyone except "Guild Member"...`, 'Setup');

    // Configure category overwrites:
    // - Deny ViewChannel for @everyone (which shares the guildId)
    // - Allow ViewChannel for Guild Member
    await (category as any).permissionOverwrites.set([
      {
        id: guildId, // @everyone role ID
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: guildMemberRoleId, // Guild Member role ID
        allow: [PermissionFlagsBits.ViewChannel],
      }
    ], 'Set category access to Guild Member role only');

    logger.success(`Successfully configured category "${category.name}" permissions!`, 'Setup');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to configure category permissions:', 'Setup');
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
