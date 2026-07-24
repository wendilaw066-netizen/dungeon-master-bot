import { EmbedBuilder } from 'discord.js';
import { PlayerInventory, MinigameDB, saveMinigameDB, getPlayer } from '../minigame';
import { COLORS } from './ui';

export function tempa(userId: string, slotStr: string): { embeds: EmbedBuilder[] } {
  const db = require('../minigame').loadMinigameDB();
  const player = getPlayer(db, userId);

  const slotFilter = ['weapon', 'shield', 'helmet', 'armor', 'gloves', 'boots', 'necklace', 'earrings', 'ring', 'pet', 'artifact'];
  
  if (!slotStr || !slotFilter.includes(slotStr.toLowerCase())) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌ Slot Tidak Valid')
      .setDescription(`Pilih slot yang valid: \`${slotFilter.join(', ')}\`\nContoh: \`!tempa weapon\``);
    return { embeds: [embed] };
  }

  const slot = slotStr.toLowerCase() as keyof PlayerInventory['equipment'];
  const eq = player.equipment[slot];

  if (!eq || !eq.name) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌ Tidak Ada Item')
      .setDescription(`Kamu tidak memakai apapun di slot **${String(slot)}**!`);
    return { embeds: [embed] };
  }

  const currentLevel = eq.level || 0;
  if (currentLevel >= 10) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌ Max Level')
      .setDescription(`Item **${eq.name}** sudah mencapai level maksimal (+10)!`);
    return { embeds: [embed] };
  }

  const cost = 10 + (currentLevel * 5); // 10 Coin, 15 Coin, 20 Coin, etc.
  
  if (player.coins < cost) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌ Miskin Coin')
      .setDescription(`Butuh **${cost} Coin** untuk menimpa ke +${currentLevel + 1}!\nUangmu: **${player.coins} Coin**`);
    return { embeds: [embed] };
  }

  player.coins -= cost;

  // Success chance: 80% at lv 0, drops by 5% each level. Min 30%.
  const successChance = Math.max(0.3, 0.8 - (currentLevel * 0.05));
  const roll = Math.random();

  let resultEmbed = new EmbedBuilder();

  if (roll <= successChance) {
    eq.level = currentLevel + 1;
    resultEmbed.setColor(COLORS.SUCCESS)
      .setTitle('✨ Tempa Berhasil!')
      .setDescription(`Senjatamu bersinar terang!\n\n**${eq.name}** naik menjadi **+${eq.level}**!\nKamu membayar **${cost} Coin**.`);
  } else {
    // Fail! 20% chance to drop level if level > 4
    if (currentLevel > 4 && Math.random() < 0.2) {
      eq.level = currentLevel - 1;
      resultEmbed.setColor(COLORS.BANK_WARN)
        .setTitle('💥 Tempa GAGAL! LEVEL TURUN!')
        .setDescription(`Asap hitam mengepul...\n\nLevel **${eq.name}** turun menjadi **+${eq.level}**!\nKamu membuang **${cost} Coin** sia-sia.`);
    } else {
      resultEmbed.setColor(COLORS.BANK_WARN)
        .setTitle('❌ Tempa Gagal...')
        .setDescription(`Tidak terjadi apa-apa pada **${eq.name}**, tapi kamu tetap kehilangan **${cost} Coin**.`);
    }
  }

  saveMinigameDB(db);
  return { embeds: [resultEmbed] };
}
