import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';
import { Command } from '../types';
import { db } from '../database';

export const botPlaygameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Kelola & perintahkan bot AI untuk bermain game RPG & auto-status!')
    .addSubcommand(sub =>
      sub.setName('playgame')
        .setDescription('Aktifkan auto-play bot AI + auto-status laporan setiap 5 menit di channel ini')
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Hentikan auto-status laporan bot')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Lihat status bot sekarang')
    )
    .addSubcommand(sub =>
      sub.setName('startevent')
        .setDescription('Manually trigger a random AI event for a random governor')
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand(false);
    const { botStatusChannels } = require('../events/ready');

    // ── /bot stop ──
    if (sub === 'stop') {
      const guildId = interaction.guildId || '';
      botStatusChannels.delete(guildId);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🛑 Auto-Status Dihentikan')
          .setDescription('Bot tidak akan lagi mengirim laporan status otomatis ke channel ini.\n\nGunakan `/bot playgame` untuk mengaktifkan kembali.')
          .setTimestamp()],
      });
      return;
    }

    // ── /bot status ──
    // ── /bot status ──
    if (sub === 'status') {
      const { loadMinigameDB, getPlayer } = require('../utils/minigame');
      const db = loadMinigameDB();
      const botName = interaction.client.user?.username || 'ZHU Bot';
      const botId = botName;
      const botPlayer = getPlayer(db, botId);
      const guildId = interaction.guildId || '';
      const isActive = botStatusChannels.has(guildId);

      const town = botPlayer.town || { tier: 1, villagers: 0, army: { infantry: 0, archers: 0, cavalry: 0 } };

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🤖 Status Bot — ${botName}`)
          .setDescription(isActive ? '🟢 **AI Simulator ACTIVE** (ticks every 5 mins)' : '🔴 **AI Simulator INACTIVE** — Use `/bot playgame` to initialize')
          .addFields(
            { name: '🪙 Treasury Balances', value: `🔑 **World Lock (Coin):** \`${botPlayer.coins}\`\n💸 **Diamond Lock (DL):** \`${botPlayer.dls}\``, inline: true },
            { name: '🚩 Faction Alliance', value: `Aligned: \`${botPlayer.faction || 'None'}\``, inline: true },
            { name: '🏰 City Tier', value: `Tier \`${town.tier}\` Domain`, inline: true },
            { name: '👥 Population', value: `Peasants: \`${town.villagers}\``, inline: true },
            { name: '⚔️ Regiment', value: `Infantry: \`${town.army?.infantry || 0}\` | Archers: \`${town.army?.archers || 0}\` | Cavalry: \`${town.army?.cavalry || 0}\``, inline: true }
          )
          .setTimestamp()],
      });
      return;
    }

    // ── /bot startevent ──
    if (sub === 'startevent') {
      await interaction.deferReply();
      const { triggerRandomEvent } = require('../utils/rpg/alerts');
      const result = await triggerRandomEvent(interaction.client);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🎲 MANUAL AI EVENT TRIGGER')
        .setDescription(result || '❌ Tidak ada pemain terdaftar untuk menerima event.')
        .setFooter({ text: 'Self-Learning AI Event Engine' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ── /bot playgame ──
    const { loadMinigameDB, getPlayer, saveMinigameDB } = require('../utils/minigame');
    const { personas } = require('../utils/personas');
    const { runBotFullAI } = require('../utils/rpg/bot_full_ai');
    
    await interaction.deferReply();
    const db = loadMinigameDB();

    // Activate farming autoPlay state for all bots and execute immediate grinding tick
    const botName = interaction.client.user?.username || 'ZHU';
    const allPersonaNames = personas.map((p: any) => p.name);
    const botIds = [botName, ...allPersonaNames];
    const factions: ('Shu' | 'Wei' | 'Wu')[] = ['Shu', 'Wei', 'Wu'];
    let fIdx = 0;
    const activatedBots: string[] = [];
    const allActions: string[] = [];

    for (const bid of botIds) {
      const p = getPlayer(db, bid);
      p.autoPlayActive = true;
      p.discordName = bid;
      if (!p.faction) {
        p.faction = factions[fIdx % factions.length];
      }
      fIdx++;
      
      const actions = runBotFullAI(db, bid, bid);
      activatedBots.push(`• **${bid}** — Faksi \`${p.faction}\` | 🏰 Tier ${p.town?.tier || 1} | 💰 ${p.coins} Coin`);
      if (actions.length > 0) {
        allActions.push(...actions.slice(0, 2)); // Max 2 actions per bot in summary
      }
    }

    // Enable auto-status every 5 minutes in this channel
    const channelId = interaction.channelId;
    const guildId = interaction.guildId || '';
    botStatusChannels.set(guildId, { channelId, guildId });

    saveMinigameDB(db);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🤖 THREE KINGDOMS AI SIMULATOR — AKTIF!')
      .setDescription(
        `✅ **${botIds.length} Bot AI** telah diinisialisasi dan langsung memulai grinding!\n` +
        `Setiap **5 menit**, simulator akan mengeksekusi aksi strategis dan mengirim laporan ke <#1419848898293268485>.\n`
      )
      .addFields(
        {
          name: `🏰 Bot Terdaftar (${botIds.length})`,
          value: activatedBots.slice(0, 13).join('\n') || '*None*',
          inline: false
        },
        {
          name: '⚡ Aksi Pertama yang Dieksekusi',
          value: allActions.length > 0 
            ? allActions.slice(0, 8).join('\n')
            : '*Bot sedang mengumpulkan resources awal...*',
          inline: false
        }
      )
      .setFooter({ text: 'Self-Learning AI Engine • /bot stop untuk menghentikan' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export const dashboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Lihat Owner Dashboard — monitoring semua asset pemain & bot secara realtime'),
  async execute(interaction: ChatInputCommandInteraction) {
    const PORT = process.env.DASHBOARD_PORT || '3420';
    const cfUrl = (global as any).cloudflareDashboardUrl;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('💎 Owner Asset Dashboard')
        .setDescription(
          `Dashboard realtime tersedia di:\n` +
          (cfUrl ? `**🌐 Online: [Akses Cloudflare Dashboard](${cfUrl})**\n\n` : '') +
          `**💻 Local: http://localhost:${PORT}**\n\n` +
          `✨ **Fitur Dashboard:**\n` +
          `✅ Semua pemain & bot beserta asset (Coin, DL, Gems)\n` +
          `✅ 🏆 Ranking kekayaan\n` +
          `✅ 🔍 Pencarian pemain\n` +
          `✅ 🔄 Auto-refresh setiap 30 detik\n` +
          `✅ 📜 HP, Job, Dungeon Progress, Farm Level\n` +
          `✅ 🏰 Status Kota\n\n` +
          (cfUrl ? `*Note: Link Cloudflare bersifat sementara dan dapat diakses kapanpun & dimanapun selagi bot online.*` : `*Note: Akses dari browser di server yang sama (localhost).*`)
        )
        .setTimestamp()],
      ephemeral: true
    });
  },
};

export const menuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Buka Dashboard Utama Kerajaan interaktif satu-klik!'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { renderDashboard } = require('../utils/rpg/dashboard');
    const { loadMinigameDB, getPlayer } = require('../utils/minigame');
    const { closeOldSession, registerNewSession } = require('../utils/rpg/session');
    const db = loadMinigameDB();
    const player = getPlayer(db, interaction.user.id);

    await closeOldSession(interaction.client, player, db);

    const resp = renderDashboard(player, interaction.user.username);
    const reply = await interaction.reply({ embeds: resp.embeds, components: resp.components, fetchReply: true });
    if (reply) {
      registerNewSession(player, reply.id, reply.channelId, db);
    }
  }
};

export const kotaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('kota')
    .setDescription('Buka Dashboard Utama Kerajaan interaktif satu-klik!'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { renderDashboard } = require('../utils/rpg/dashboard');
    const { loadMinigameDB, getPlayer } = require('../utils/minigame');
    const { closeOldSession, registerNewSession } = require('../utils/rpg/session');
    const db = loadMinigameDB();
    const player = getPlayer(db, interaction.user.id);

    await closeOldSession(interaction.client, player, db);

    const resp = renderDashboard(player, interaction.user.username);
    const reply = await interaction.reply({ embeds: resp.embeds, components: resp.components, fetchReply: true });
    if (reply) {
      registerNewSession(player, reply.id, reply.channelId, db);
    }
  }
};

export const gamesCommands = [botPlaygameCommand, dashboardCommand, menuCommand, kotaCommand];
