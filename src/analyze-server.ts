import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = '571992648190263317';

if (!token) {
  logger.error('Missing DISCORD_TOKEN environment variable!', 'Analysis');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.once('ready', async () => {
  try {
    logger.info(`Connected to Discord. Fetching guild ${guildId}...`, 'Analysis');

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.error(`Guild ${guildId} could not be found or fetched. Is the bot a member of that server?`, 'Analysis');
      console.log('BOT_NOT_IN_GUILD');
      process.exit(0);
    }

    logger.info(`Found Guild: "${guild.name}"`, 'Analysis');

    // 1. General Details
    const name = guild.name;
    const memberCount = guild.memberCount;
    const owner = await guild.fetchOwner().catch(() => null);
    const ownerTag = owner ? owner.user.tag : 'Unknown';
    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostTier = guild.premiumTier;
    const createdDate = guild.createdAt.toLocaleString();
    const description = guild.description || 'No description';
    const mfaLevel = guild.mfaLevel;
    const verificationLevel = guild.verificationLevel;

    // 2. Channels breakdown
    const channels = await guild.channels.fetch();
    let textChannelsCount = 0;
    let voiceChannelsCount = 0;
    let categoryCount = 0;
    let forumCount = 0;
    let announcementCount = 0;
    
    channels.forEach(ch => {
      if (!ch) return;
      if (ch.type === ChannelType.GuildText) textChannelsCount++;
      else if (ch.type === ChannelType.GuildVoice) voiceChannelsCount++;
      else if (ch.type === ChannelType.GuildCategory) categoryCount++;
      else if (ch.type === ChannelType.GuildAnnouncement) announcementCount++;
      else if (ch.type === ChannelType.GuildForum) forumCount++;
    });

    // 3. Roles breakdown
    const roles = await guild.roles.fetch();
    const totalRoles = roles.size;
    const rolesList = roles.map(r => r.name).slice(0, 15).join(', ') + (roles.size > 15 ? '...' : '');

    // 4. Emojis breakdown
    const emojis = await guild.emojis.fetch();
    const staticEmojis = emojis.filter(e => !e.animated).size;
    const animatedEmojis = emojis.filter(e => e.animated).size;

    // 5. Verification level detail
    const verificationLevels = ['None', 'Low (Verified Email)', 'Medium (Registered >5m)', 'High (Member >10m)', 'Very High (Verified Phone)'];
    const verifStr = verificationLevels[verificationLevel] || 'Unknown';

    // Output formatted analysis JSON for parent agent
    const analysisReport = {
      guildId,
      name,
      description,
      owner: ownerTag,
      memberCount,
      boosts: { count: boostCount, tier: boostTier },
      createdDate,
      security: {
        verificationLevel: verifStr,
        twoFactorAuthRequired: mfaLevel === 1,
      },
      channels: {
        total: channels.size,
        text: textChannelsCount,
        announcement: announcementCount,
        voice: voiceChannelsCount,
        forum: forumCount,
        categories: categoryCount
      },
      roles: {
        total: totalRoles,
        sample: rolesList
      },
      emojis: {
        total: emojis.size,
        static: staticEmojis,
        animated: animatedEmojis
      }
    };

    console.log('ANALYSIS_REPORT_START');
    console.log(JSON.stringify(analysisReport, null, 2));
    console.log('ANALYSIS_REPORT_END');

    process.exit(0);
  } catch (error) {
    logger.error('Failed during server analysis:', 'Analysis');
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
