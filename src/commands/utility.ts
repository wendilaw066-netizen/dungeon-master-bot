import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import * as os from 'os';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Replies with the bot's latency!"),
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x00ff99) // Sleek neon green
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency', value: `${latency}ms`, inline: true },
        { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

export const serverinfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Displays detailed information about the server.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { guild } = interaction;
    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    const owner = await guild.fetchOwner();
    const members = guild.memberCount;
    const roles = guild.roles.cache.size;
    const channels = guild.channels.cache.size;
    const createdAt = guild.createdAt.toLocaleDateString();

    const embed = new EmbedBuilder()
      .setColor(0x3366ff) // Premium royal blue
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ forceStatic: false }) || null)
      .addFields(
        { name: 'Owner', value: `${owner.user.tag}`, inline: true },
        { name: 'Created On', value: createdAt, inline: true },
        { name: 'Members', value: `${members}`, inline: true },
        { name: 'Channels', value: `${channels}`, inline: true },
        { name: 'Roles', value: `${roles}`, inline: true },
        { name: 'Boost Level', value: `${guild.premiumTier}`, inline: true }
      )
      .setFooter({ text: `Guild ID: ${guild.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const userinfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Displays information about a user.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to view info for')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('target') || interaction.user;
    const member = await interaction.guild?.members.fetch(user.id);

    if (!member) {
      await interaction.reply({ content: 'Could not find that member in this server!', ephemeral: true });
      return;
    }

    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => role.toString())
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(0xff33cc) // Sleek magenta
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: 'Account Created', value: user.createdAt.toLocaleDateString(), inline: true },
        { name: 'Joined Server', value: member.joinedAt?.toLocaleDateString() || 'N/A', inline: true },
        { name: 'Bot Account', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: `Roles [${member.roles.cache.size - 1}]`, value: roles }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const aboutCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Displays information and stats about this bot.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalGuilds = client.guilds.cache.size;

    const embed = new EmbedBuilder()
      .setColor(0x3366ff)
      .setTitle('ℹ️ About Bot')
      .setThumbnail(client.user?.displayAvatarURL() || null)
      .addFields(
        { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: 'Memory Usage', value: `${memoryUsage} MB`, inline: true },
        { name: 'Active Servers', value: `${totalGuilds}`, inline: true },
        { name: 'Node.js Version', value: `${process.version}`, inline: true },
        { name: 'OS Platform', value: `${os.platform()} (${os.arch()})`, inline: true }
      )
      .setFooter({ text: `Client ID: ${client.user?.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const pollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll with thumbs up/down reactions.')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('The question to ask in the poll')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question')!;

    const embed = new EmbedBuilder()
      .setColor(0x00ffcc)
      .setTitle('📊 Server Poll')
      .setDescription(question)
      .setFooter({ text: `Created by ${interaction.user.tag}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('👍').catch(() => null);
    await message.react('👎').catch(() => null);
  },
};

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows a complete list of commands.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle('📚 Command Directory')
      .setDescription('Use `/` before any command. Here is a list of all active features:')
      .addFields(
        {
          name: '🛡️ Configuration',
          value: '`/config welcome-channel` | `/config default-role` | `/config mod-log` | `/config reward-role`'
        },
        {
          name: '🛡️ Moderation',
          value: '`/warn` | `/warnings` | `/purge` (clear chat) | `/kick` | `/ban`'
        },
        {
          name: '🏆 Leveling & Stats',
          value: '`/rank` (level progress) | `/leaderboard` (rankings)'
        },
        {
          name: '🪙 Economy',
          value: '`/balance` | `/daily` (claim daily coins) | `/gamble` | `/give`'
        },
        {
          name: '⚙️ Utilities',
          value: '`/ping` | `/about` | `/serverinfo` | `/userinfo` | `/poll`'
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const utilityCommands = [pingCommand, serverinfoCommand, userinfoCommand, aboutCommand, pollCommand, helpCommand];
