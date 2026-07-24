import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = '1419848896762613921';

if (!token) {
  logger.error('Missing DISCORD_TOKEN environment variable!', 'Setup');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  try {
    logger.info('Connected to Discord. Setting up role channel...', 'Setup');

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.error(`Guild ${guildId} not found! Is the bot in the server?`, 'Setup');
      process.exit(1);
    }

    // 1. Get or Create Roles
    logger.info('Checking roles...', 'Setup');
    
    let memberRole = guild.roles.cache.find(r => r.name === 'Guild Member');
    if (!memberRole) {
      memberRole = await guild.roles.create({
        name: 'Guild Member',
        color: 0x00FF99,
        reason: 'Self-role panel setup',
      });
      logger.success('Created role: Guild Member', 'Setup');
    } else {
      logger.info('Role "Guild Member" already exists.', 'Setup');
    }

    let visitorRole = guild.roles.cache.find(r => r.name === 'Visitor');
    if (!visitorRole) {
      visitorRole = await guild.roles.create({
        name: 'Visitor',
        color: 0xFFAA00,
        reason: 'Self-role panel setup',
      });
      logger.success('Created role: Visitor', 'Setup');
    } else {
      logger.info('Role "Visitor" already exists.', 'Setup');
    }

    let viewersRole = guild.roles.cache.find(r => r.name === 'Viewers');
    if (!viewersRole) {
      viewersRole = await guild.roles.create({
        name: 'Viewers',
        color: 0x00D2FF,
        reason: 'Self-role panel setup',
      });
      logger.success('Created role: Viewers', 'Setup');
    } else {
      logger.info('Role "Viewers" already exists.', 'Setup');
    }

    // 2. Get Channel "ambil-role"
    logger.info('Checking channel "ambil-role"...', 'Setup');
    let channel = guild.channels.cache.find(c => c.name === 'ambil-role' && c.type === ChannelType.GuildText) as any;
    
    if (!channel) {
      channel = await guild.channels.create({
        name: 'ambil-role',
        type: ChannelType.GuildText,
        reason: 'Self-role channel setup',
      });
      logger.success('Created channel: #ambil-role', 'Setup');
    } else {
      logger.info('Channel "#ambil-role" already exists.', 'Setup');
    }

    // Clear old messages in #ambil-role to remove the old panel
    logger.info('Clearing old messages in #ambil-role...', 'Setup');
    const messages = await channel.messages.fetch({ limit: 20 });
    for (const msg of messages.values()) {
      await msg.delete().catch(() => null);
    }
    logger.info('Channel cleared.', 'Setup');

    // 3. Post New Role Panel Embed
    logger.info('Sending updated role panel embed...', 'Setup');

    const embed = new EmbedBuilder()
      .setColor(0xff0000) // Red border
      .setTitle('🎭 Get Server Roles | Ambil Role')
      .setDescription(
        'Choose your roles below! / Pilih role Anda di bawah ini:\n\n' +
        '🟢 **Guild Member** - Join the guild member category\n' +
        '👤 **Visitor** - Mark yourself as a server visitor\n' +
        '👀 **Viewers** - View server announcements & categories\n\n' +
        '⚠️ *Note: You must complete Double Counter verification first to claim roles!*\n' +
        '⚠️ *Catatan: Anda harus menyelesaikan verifikasi Double Counter terlebih dahulu untuk memilih role!*'
      )
      .setThumbnail(guild.iconURL() || null)
      .setFooter({ text: 'ZHU Verification & Role System' });

    const memberBtn = new ButtonBuilder()
      .setCustomId(`selfrole-${memberRole.id}`)
      .setLabel('Guild Member')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success);

    const visitorBtn = new ButtonBuilder()
      .setCustomId(`selfrole-${visitorRole.id}`)
      .setLabel('Visitor')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary);

    const viewersBtn = new ButtonBuilder()
      .setCustomId(`selfrole-${viewersRole.id}`)
      .setLabel('Viewers')
      .setEmoji('👀')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(memberBtn, visitorBtn, viewersBtn);

    await channel.send({ embeds: [embed], components: [row] });
    logger.success('Updated Role panel message posted successfully!', 'Setup');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to setup role channel:', 'Setup');
    logger.error(error as Error);
    process.exit(1);
  }
});

client.login(token);
