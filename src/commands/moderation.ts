import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../types';
import { db } from '../database';
import { logModAction } from '../utils/mod-logger';

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member in the server.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target')!;
    const reason = interaction.options.getString('reason')!;
    const guildId = interaction.guildId!;

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (member?.user.bot) {
      await interaction.reply({ content: 'You cannot warn bot accounts!', ephemeral: true });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot warn yourself!', ephemeral: true });
      return;
    }

    const warning = db.addWarning(guildId, target.id, reason, interaction.user.id);
    const warningsCount = db.getWarnings(guildId, target.id).length;

    const embed = new EmbedBuilder()
      .setColor(0xff9900) // Orange warning color
      .setTitle('⚠️ User Warned')
      .addFields(
        { name: 'User', value: `${target.tag} (<@${target.id}>)`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Total Warnings', value: `${warningsCount}`, inline: true }
      )
      .setFooter({ text: `Warning ID: ${warning.id}` })
      .setTimestamp();

    // Log moderation action
    await logModAction(interaction.client, interaction.guild!, '⚠️ Warning Issued', [
      { name: 'User', value: `${target.tag} (<@${target.id}>)`, inline: true },
      { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
      { name: 'Reason', value: reason }
    ], 0xff9900);

    // Try to DM the user
    try {
      await target.send({ content: `⚠️ You have been warned in **${interaction.guild?.name}**.\n**Reason:** ${reason}` });
    } catch {
      // Ignore if DMs are closed
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export const warningsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Lists warnings for a server member.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to view warnings for')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target')!;
    const guildId = interaction.guildId!;

    const warnings = db.getWarnings(guildId, target.id);

    if (warnings.length === 0) {
      await interaction.reply({ content: `✅ **${target.tag}** has no active warnings in this server.`, ephemeral: false });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle(`📜 Warnings history for: ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ forceStatic: false }))
      .setTimestamp();

    const lines = warnings.map((warn, index) => {
      const date = new Date(warn.timestamp).toLocaleDateString();
      return `**${index + 1}.** ID: \`${warn.id}\` | Date: **${date}** | Mod: <@${warn.moderatorId}>\nReason: *${warn.reason}*`;
    });

    embed.setDescription(lines.join('\n\n'));

    await interaction.reply({ embeds: [embed] });
  },
};

export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from the server.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target')!;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild!;

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Could not find that member in this server!', ephemeral: true });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot kick yourself!', ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({ content: 'I do not have permissions to kick this user! They might have a higher role than me.', ephemeral: true });
      return;
    }

    // Try to DM the user
    try {
      await target.send({ content: `🚪 You have been kicked from **${guild.name}**.\n**Reason:** ${reason}` });
    } catch {
      // Ignore if DMs are closed
    }

    await member.kick(reason);

    // Log moderation action
    await logModAction(interaction.client, guild, '🚪 Member Kicked', [
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
      { name: 'Reason', value: reason }
    ], 0xff3300);

    const embed = new EmbedBuilder()
      .setColor(0xff3300) // Red-orange
      .setTitle('👢 Member Kicked')
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from the server.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target')!;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild!;

    const member = await guild.members.fetch(target.id).catch(() => null);

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot ban yourself!', ephemeral: true });
      return;
    }

    if (member && !member.bannable) {
      await interaction.reply({ content: 'I do not have permissions to ban this user! They might have a higher role than me.', ephemeral: true });
      return;
    }

    // Try to DM the user
    try {
      await target.send({ content: `🔨 You have been banned from **${guild.name}**.\n**Reason:** ${reason}` });
    } catch {
      // Ignore if DMs are closed
    }

    await guild.members.ban(target.id, { reason });

    // Log moderation action
    await logModAction(interaction.client, guild, '🔨 Member Banned', [
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
      { name: 'Reason', value: reason }
    ], 0xcc0000);

    const embed = new EmbedBuilder()
      .setColor(0xcc0000) // Deep red
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const purgeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk deletes messages in the current channel.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount')!;
    const channel = interaction.channel;

    if (!channel || !('bulkDelete' in channel)) {
      await interaction.reply({ content: 'I cannot bulk delete messages in this channel type!', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const deleted = await (channel as any).bulkDelete(amount, true);
      
      // Log moderation action
      await logModAction(interaction.client, interaction.guild!, '🧹 Chat Purged', [
        { name: 'Channel', value: `${channel.toString()}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
        { name: 'Messages Deleted', value: `${deleted.size}`, inline: true }
      ], 0x9933ff);

      await interaction.editReply({ content: `🧹 Successfully deleted **${deleted.size}** messages!` });
    } catch (error) {
      await interaction.editReply({ content: 'Failed to purge messages. Note: I cannot delete messages older than 14 days due to Discord restrictions.' });
    }
  },
};

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // welcome channel config
    .addSubcommand(sub =>
      sub.setName('welcome-channel')
        .setDescription('Set the welcome channel for greeting new members.')
        .addChannelOption(opt => opt.setName('channel').setDescription('Select the welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    // default role config
    .addSubcommand(sub =>
      sub.setName('default-role')
        .setDescription('Set the role auto-assigned to new members.')
        .addRoleOption(opt => opt.setName('role').setDescription('Select the default role').setRequired(true))
    )
    // mod logging channel config
    .addSubcommand(sub =>
      sub.setName('mod-log')
        .setDescription('Set the channel for moderation logs.')
        .addChannelOption(opt => opt.setName('channel').setDescription('Select the log channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    // reward role config
    .addSubcommand(sub =>
      sub.setName('reward-role')
        .setDescription('Set a role reward for reaching a level.')
        .addIntegerOption(opt => opt.setName('level').setDescription('Target level').setRequired(true).setMinValue(1))
        .addRoleOption(opt => opt.setName('role').setDescription('Role reward').setRequired(true))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'welcome-channel') {
      const channel = interaction.options.getChannel('channel')!;
      db.updateGuildSettings(guildId, { welcomeChannelId: channel.id });
      await interaction.reply({ content: `✅ Welcome channel has been set to ${channel.toString()}` });
    } 
    else if (subcommand === 'default-role') {
      const role = interaction.options.getRole('role')!;
      db.updateGuildSettings(guildId, { defaultRoleId: role.id });
      await interaction.reply({ content: `✅ Default joining role has been set to **${role.name}**` });
    } 
    else if (subcommand === 'mod-log') {
      const channel = interaction.options.getChannel('channel')!;
      db.updateGuildSettings(guildId, { modLogChannelId: channel.id });
      await interaction.reply({ content: `✅ Moderation logs channel has been set to ${channel.toString()}` });
    } 
    else if (subcommand === 'reward-role') {
      const level = interaction.options.getInteger('level')!;
      const role = interaction.options.getRole('role')!;
      db.setLevelRole(guildId, level, role.id);
      await interaction.reply({ content: `✅ Users reaching **Level ${level}** will now be rewarded with the **${role.name}** role!` });
    }
  },
};

export const moderationCommands = [warnCommand, warningsCommand, kickCommand, banCommand, purgeCommand, configCommand];
