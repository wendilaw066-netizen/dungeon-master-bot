import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { db } from '../database';

// Helper to calculate XP needed for a level
// Level 1 -> 2: 150 XP
// Level 2 -> 3: 300 XP
// Level 3 -> 4: 450 XP, etc.
export function getXpForLevel(level: number): number {
  return level * 150;
}

export function getProgressBar(current: number, target: number, size = 10): string {
  const percentage = Math.min(Math.max(current / target, 0), 1);
  const progress = Math.round(size * percentage);
  const emptyProgress = size - progress;

  const progressText = '█'.repeat(progress);
  const emptyProgressText = '░'.repeat(emptyProgress);
  const percentText = Math.round(percentage * 100);

  return `\`[${progressText}${emptyProgressText}]\` **${percentText}%**`;
}

export const rankCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Displays your current leveling rank and XP progress.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('View the rank of another member')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    const userData = db.getUser(guildId, targetUser.id);
    const xpNeeded = getXpForLevel(userData.level);
    const progress = getProgressBar(userData.xp, xpNeeded);

    const embed = new EmbedBuilder()
      .setColor(0x00d2ff) // Sleek neon blue
      .setTitle(`🏆 Rank Card: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: 'Level', value: `✨ **${userData.level}**`, inline: true },
        { name: 'Total XP', value: `📈 **${userData.xp}**`, inline: true },
        { name: 'Next Level Progress', value: `${userData.xp}/${xpNeeded} XP\n${progress}`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the top active users in the server.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    const topUsers = db.getTopUsers(guildId, 10);

    if (topUsers.length === 0) {
      await interaction.reply({ content: 'No leveling data available for this server yet. Start chatting to gain XP!', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Gold
      .setTitle('🏆 Leveling Leaderboard')
      .setDescription('Here are the most active members in the server:')
      .setTimestamp();

    const lines = await Promise.all(topUsers.map(async (user, index) => {
      let medal = '';
      if (index === 0) medal = '🥇 ';
      else if (index === 1) medal = '🥈 ';
      else if (index === 2) medal = '🥉 ';
      else medal = `\`#${index + 1}\` `;

      try {
        const member = await interaction.guild?.members.fetch(user.userId);
        const name = member ? member.displayName : `<@${user.userId}>`;
        return `${medal}**${name}** - Level **${user.level}** (${user.xp} XP)`;
      } catch {
        return `${medal}**User Left (${user.userId})** - Level **${user.level}** (${user.xp} XP)`;
      }
    }));

    embed.setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed] });
  },
};

export const levelingCommands = [rankCommand, leaderboardCommand];
