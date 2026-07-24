import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { db } from '../database';

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_AMOUNT = 200;

export const balanceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("View your current coin balance or another user's balance.")
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to view balance of')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target') || interaction.user;
    const guildId = interaction.guildId!;

    const userData = db.getUser(guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor(0xffaa00) // Gold
      .setTitle(`💰 Coins Balance: ${target.tag}`)
      .setDescription(`User has **${userData.balance}** 🪙 coins in their wallet.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily 200 🪙 coins reward.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;
    const now = Date.now();

    const userData = db.getUser(guildId, userId);
    const timePassed = now - userData.lastDailyClaim;

    if (timePassed < DAILY_COOLDOWN_MS) {
      const timeLeft = DAILY_COOLDOWN_MS - timePassed;
      const hours = Math.floor(timeLeft / 3600000);
      const minutes = Math.floor((timeLeft % 3600000) / 60000);

      await interaction.reply({
        content: `⏳ You have already claimed your daily reward today. Please try again in **${hours} hours and ${minutes} minutes**.`,
        ephemeral: true,
      });
      return;
    }

    db.addBalance(guildId, userId, DAILY_AMOUNT);
    db.updateUser(guildId, userId, { lastDailyClaim: now });

    const embed = new EmbedBuilder()
      .setColor(0x00ff99) // Neon green success
      .setTitle('Claimed Daily Coins!')
      .setDescription(`🪙 **+${DAILY_AMOUNT}** coins successfully added to your wallet!`)
      .addFields({ name: 'New Balance', value: `**${userData.balance + DAILY_AMOUNT}** coins` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const gambleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gamble a specific amount of coins (Double or Nothing).')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of coins to gamble')
        .setRequired(true)
        .setMinValue(10)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount')!;
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    const userData = db.getUser(guildId, userId);

    if (userData.balance < amount) {
      await interaction.reply({
        content: `❌ You do not have enough coins to gamble! Current balance: **${userData.balance}** coins.`,
        ephemeral: true,
      });
      return;
    }

    const won = Math.random() < 0.5;

    if (won) {
      db.addBalance(guildId, userId, amount);
      const embed = new EmbedBuilder()
        .setColor(0x00ff99) // Green
        .setTitle('🎉 You Won!')
        .setDescription(`You doubled your bet and won **${amount}** 🪙 coins!`)
        .addFields({ name: 'New Balance', value: `**${userData.balance + amount}** coins` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } else {
      db.deductBalance(guildId, userId, amount);
      const embed = new EmbedBuilder()
        .setColor(0xff3300) // Red
        .setTitle('😢 You Lost')
        .setDescription(`Bad luck! You lost **${amount}** 🪙 coins.`)
        .addFields({ name: 'New Balance', value: `**${userData.balance - amount}** coins` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export const giveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Transfer your coins to another user.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to transfer coins to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of coins to transfer')
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target')!;
    const amount = interaction.options.getInteger('amount')!;
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    if (target.id === userId) {
      await interaction.reply({ content: '❌ You cannot transfer coins to yourself!', ephemeral: true });
      return;
    }

    if (target.bot) {
      await interaction.reply({ content: '❌ You cannot transfer coins to bot accounts!', ephemeral: true });
      return;
    }

    const senderData = db.getUser(guildId, userId);

    if (senderData.balance < amount) {
      await interaction.reply({
        content: `❌ You do not have enough coins! Current balance: **${senderData.balance}** coins.`,
        ephemeral: true,
      });
      return;
    }

    db.deductBalance(guildId, userId, amount);
    db.addBalance(guildId, target.id, amount);

    const embed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setTitle('💰 Coins Transferred')
      .setDescription(`Successfully sent **${amount}** 🪙 coins to <@${target.id}>!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export const economyCommands = [balanceCommand, dailyCommand, gambleCommand, giveCommand];
