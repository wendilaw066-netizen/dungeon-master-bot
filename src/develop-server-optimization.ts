import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';
import { db } from './database';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = '1419848896762613921';

// Role IDs
const adminRoleId = '1419848896934576204';
const moderatorRoleId = '1419848896934576203';

// Level Role Mappings
const levelRoleMappings: { [key: string]: string } = {
  "1": "1419848896892375049",
  "5": "1419848896892375048",
  "10": "1419848896892375047",
  "20": "1419848896892375046",
  "25": "1419848896892375045",
  "30": "1419848896892375044",
  "35": "1419848896892375043",
  "40": "1419848896892375042",
  "45": "1419848896892375041",
  "50": "1419848896892375040"
};

if (!token) {
  logger.error('Missing DISCORD_TOKEN environment variable!', 'Setup');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  try {
    logger.info('Connected to Discord. Running optimization setup...', 'Setup');

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.error(`Guild ${guildId} not found!`, 'Setup');
      process.exit(1);
    }

    // 1. Get or Create Private Staff Log Channel
    logger.info('Checking staff logs channel...', 'Setup');
    let staffLogChannel = guild.channels.cache.find(c => 
      c.name.includes('staff-logs') && c.type === ChannelType.GuildText
    ) as any;

    if (!staffLogChannel) {
      logger.info('Creating private channel "#🚨〡staff-logs"...', 'Setup');
      staffLogChannel = await guild.channels.create({
        name: '🚨〡staff-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guildId, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: adminRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          {
            id: moderatorRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          }
        ],
        reason: 'Private server staff logging',
      });
      logger.success('Created private channel #🚨〡staff-logs', 'Setup');
    } else {
      logger.info('Private channel #🚨〡staff-logs already exists.', 'Setup');
    }

    // 2. Update DB with Mod Log Channel ID
    logger.info('Updating modLogChannelId in database...', 'Setup');
    db.updateGuildSettings(guildId, {
      modLogChannelId: staffLogChannel.id
    });
    logger.success(`Configured modLogChannelId to ${staffLogChannel.id}`, 'Setup');

    // 3. Populate Leveling Roles in database.json
    logger.info('Setting up level role rewards in database...', 'Setup');
    for (const [level, roleId] of Object.entries(levelRoleMappings)) {
      db.setLevelRole(guildId, parseInt(level), roleId);
    }
    logger.success('Level roles mapped successfully in database.json!', 'Setup');

    logger.success('Server optimization script completed successfully!', 'Setup');
    process.exit(0);
  } catch (error) {
    logger.error('Failed during server optimization setup:', 'Setup');
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
