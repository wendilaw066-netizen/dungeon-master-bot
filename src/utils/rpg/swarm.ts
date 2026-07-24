import { EmbedBuilder } from 'discord.js';
import { PlayerInventory, MinigameDB, saveMinigameDB } from '../minigame';
import { COLORS, fmt } from './ui';

export function handleSwarmCatch(player: PlayerInventory, db: MinigameDB): any {
  // Check daily reset
  const today = new Date().toISOString().split('T')[0];
  if (player.swarm?.lastCatchDate !== today) {
    player.swarm!.lastCatchDate = today;
    player.swarm!.dailyCatch = 0;
  }

  // Stamina cost
  if (player.hp < 15) {
    return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu terlalu lelah. Butuh minimal 15 HP untuk mengejar kawanan hewan.')] };
  }

  player.hp -= 15;
  player.swarm!.dailyCatch++;

  // Diminishing returns: 100 catches max. After that, success rate drops severely
  let baseChance = 0.6; // 60% base
  if (player.swarm!.dailyCatch > 100) {
    baseChance = 0.05; // 5% base
  } else if (player.swarm!.dailyCatch > 50) {
    baseChance = 0.3; // 30% base
  }

  const success = Math.random() < baseChance;
  let gainedWood = 0;
  let msg = '';

  if (success) {
    player.swarm!.mysticAnimals++;
    // 30% chance to also drop Mystic Wood for zoo upgrading
    if (Math.random() < 0.3) {
      gainedWood = 1;
      player.swarm!.mysticWood++;
    }
    msg = `🎉 Kamu berhasil menangkap **1 Mystic Animal**!\nSekarang kamu punya ${player.swarm!.mysticAnimals} Mystic Animals.`;
    if (gainedWood > 0) msg += `\n🌳 Mendapatkan **1 Mystic Wood**!`;
  } else {
    msg = `❌ Kawanan hewan berhasil kabur darimu... (Tangkapan ke-${player.swarm!.dailyCatch} hari ini)`;
  }

  saveMinigameDB(db);

  const emb = new EmbedBuilder()
    .setColor(success ? COLORS.SUCCESS : COLORS.BANK_WARN)
    .setTitle('🦋 THE GREAT SWARM MIGRATION')
    .setDescription(msg)
    .setFooter({ text: 'HP -15 | Batas tangkapan normal: 100/hari' });

  return { embeds: [emb] };
}

export function handleZoo(player: PlayerInventory, subcmd?: string, db?: MinigameDB): any {
  if (!player.swarm) return { content: 'Sistem Zoo belum aktif.' };

  if (subcmd === 'upgrade' && db) {
    const cost = player.swarm.zooLevel * 5; // 5, 10, 15 wood...
    if (player.swarm.mysticWood < cost) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`❌ Butuh **${cost} Mystic Wood** untuk menaikkan Zoo ke level ${player.swarm.zooLevel + 1}. Kamu hanya punya ${player.swarm.mysticWood}.`)] };
    }
    player.swarm.mysticWood -= cost;
    player.swarm.zooLevel++;
    saveMinigameDB(db);
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`🏕️ **ZOO UPGRADED!** Level Zoo kamu naik ke **Level ${player.swarm.zooLevel}**!\nProduksi Migration Token akan lebih cepat.`)] };
  }

  // Calculate passive tokens based on zoo level and animals
  // We simulate harvesting tokens when they check !zoo
  // Since we don't have a background loop per minute for this simple logic, 
  // we'll just show the stats. Real logic would involve timestamps like passive income.
  // We'll grant a simple randomized amount of tokens when catching or as passive daily login.
  // But let's actually just generate them directly based on animals.
  
  const tokenGenRate = player.swarm.mysticAnimals * player.swarm.zooLevel;

  const emb = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🏕️ MYSTIC ZOO')
    .setDescription(`Level Habitat: **${player.swarm.zooLevel}**\n\n` + 
                    `Hewan Tertangkap: **${player.swarm.mysticAnimals} Mystic Animals**\n` +
                    `Material Bangunan: **${player.swarm.mysticWood} Mystic Wood**\n` +
                    `Mata Uang Event: **${player.swarm.migrationTokens} Migration Tokens**\n\n` +
                    `Produksi Pasif Estimasi: **${tokenGenRate} Tokens / Hari** (Klaim otomatis saat login harian)`)
    .setFooter({ text: 'Gunakan `!zoo upgrade` untuk menaikkan level kandang.' });
  
  return { embeds: [emb] };
}
