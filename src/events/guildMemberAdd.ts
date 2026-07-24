import { GuildMember, Events, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../logger';
import { db } from '../database';
import { BotEvent } from '../types';

const guildMemberAddEvent: BotEvent = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    const { guild } = member;
    logger.info(`${member.user.tag} joined server: ${guild.name} (${guild.id})`, 'Join');

    const guildSettings = db.getGuildSettings(guild.id);
    
    // 1. Send Welcome Message
    const welcomeChannelId = guildSettings.welcomeChannelId || process.env.WELCOME_CHANNEL_ID;
    let welcomeChannel: TextChannel | null = null;

    if (welcomeChannelId) {
      welcomeChannel = guild.channels.cache.get(welcomeChannelId) as TextChannel;
    } else {
      // Auto-fallback: search for a text channel named "welcome" or "general"
      welcomeChannel = guild.channels.cache.find(
        (channel) => channel.isTextBased() && (channel.name.includes('welcome') || channel.name === 'general')
      ) as TextChannel;
    }

    if (welcomeChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff99) // Neon green welcome vibe
        .setTitle('👋 Welcome to the server!')
        .setDescription(`Hello <@${member.id}>, welcome to **${guild.name}**! We're thrilled to have you here.`)
        .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
        .addFields(
          { name: 'Member Count', value: `👤 Member #${guild.memberCount}`, inline: true }
        )
        .setFooter({ text: `Account Created: ${member.user.createdAt.toLocaleDateString()}` })
        .setTimestamp();

      await welcomeChannel.send({ embeds: [embed] }).catch((error: any) => {
        logger.error(`Failed to send welcome message in #${welcomeChannel?.name}:`, 'Join');
        logger.error(error as Error);
      });
    }

    // 2. Assign Default Role
    const defaultRoleId = guildSettings.defaultRoleId || process.env.DEFAULT_ROLE_ID;
    if (defaultRoleId) {
      const role = guild.roles.cache.get(defaultRoleId);
      if (role) {
        await member.roles.add(role)
          .then(() => {
            logger.info(`Assigned default role "${role.name}" to ${member.user.tag}`, 'Join');
          })
          .catch((error: any) => {
            logger.error(`Failed to assign default role "${role.name}" to ${member.user.tag}:`, 'Join');
            logger.error(error as Error);
          });
      } else {
        logger.warn(`Default role ID ${defaultRoleId} was configured but not found in server.`, 'Join');
      }
    }
  },
};

export default guildMemberAddEvent;
