import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, MinigameDB, saveMinigameDB } from '../minigame';
import { EMOJIS } from './emojis';
import { pushDashboardLog } from './dashboard';

export interface IdleExpedition {
  zoneId: string;
  zoneName: string;
  startTime: number;
  durationMs: number; // e.g. 1 hour, 4 hours, 8 hours
  troopsSent: {
    infantry: number;
    archers: number;
    cavalry: number;
    spearmen: number;
  };
  accumulatedRewards: {
    coins: number;
    gems: number;
    wood: number;
    iron: number;
    itemsFound: string[];
  };
}

export const IDLE_ZONES = [
  { id: 'mist_valley', name: '🌫️ Lembah Kabut (Low Risk)', minTroops: 10, rewardRate: { coinPerHr: 50, gemPerHr: 5, woodPerHr: 20 }, icon: '🌫️' },
  { id: 'ancient_ruins', name: '🏰 Reruntuhan Kuno (Medium Risk)', minTroops: 30, rewardRate: { coinPerHr: 150, gemPerHr: 15, ironPerHr: 15 }, icon: '🏰' },
  { id: 'dragon_nest', name: '🐲 Sarang Naga Kuno (High Risk - Epic Loot)', minTroops: 50, rewardRate: { coinPerHr: 400, gemPerHr: 40, mysticPerHr: 5 }, icon: '🐲' }
];

export function updateIdleExpeditionProgress(player: PlayerInventory): number {
  if (!player.town || !player.town.idleExpedition) return 0;
  const exp = player.town.idleExpedition;
  const now = Date.now();
  const elapsedMs = Math.min(now - exp.startTime, exp.durationMs);
  const elapsedHours = elapsedMs / 3600000;
  
  const zone = IDLE_ZONES.find(z => z.id === exp.zoneId) || IDLE_ZONES[0];
  
  // Calculate rewards based on elapsed time
  exp.accumulatedRewards.coins = Math.floor(elapsedHours * zone.rewardRate.coinPerHr);
  exp.accumulatedRewards.gems = Math.floor(elapsedHours * zone.rewardRate.gemPerHr);
  if (zone.rewardRate.woodPerHr) exp.accumulatedRewards.wood = Math.floor(elapsedHours * zone.rewardRate.woodPerHr);
  if (zone.rewardRate.ironPerHr) exp.accumulatedRewards.iron = Math.floor(elapsedHours * zone.rewardRate.ironPerHr);

  return elapsedMs;
}

export function renderIdleExpeditionMenu(player: PlayerInventory, userName: string): any {
  const town = player.town!;
  if (!town.idleExpedition) {
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`⏳ Ekspedisi Pasukan AFK / Idle RPG - ${userName}`)
      .setDescription(
        `Kirimkan pasukan Anda berburu harta karun secara otomatis saat Anda AFK/Offline! Pasukan akan mengumpulkan Koin, Gem, & Material secara terus-menerus.\n\n` +
        ` Pilih Zona Ekspedisi AFK:`
      );

    IDLE_ZONES.forEach(z => {
      embed.addFields({
        name: `${z.name}`,
        value: `• **Syarat Minimal Pasukan:** \`${z.minTroops} Prajurit\`\n• **Hasil Per-Jam:** \`+${z.rewardRate.coinPerHr} Coin\` | \`+${z.rewardRate.gemPerHr} Gems\``,
        inline: false
      });
    });

    const totalTroops = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.cavalry || 0) + (town.army?.spearmen || 0);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_idle_deploy_mist_valley').setLabel('Ekspedisi Lembah Kabut').setEmoji('🌫️').setStyle(ButtonStyle.Primary).setDisabled(totalTroops < 10),
      new ButtonBuilder().setCustomId('town_idle_deploy_ancient_ruins').setLabel('Ekspedisi Reruntuhan Kuno').setEmoji('🏰').setStyle(ButtonStyle.Success).setDisabled(totalTroops < 30),
      new ButtonBuilder().setCustomId('town_idle_deploy_dragon_nest').setLabel('Ekspedisi Sarang Naga').setEmoji('🐲').setStyle(ButtonStyle.Danger).setDisabled(totalTroops < 50)
    );

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_main').setLabel('Kembali').setEmoji(EMOJIS.btn_back || '🔙').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row, backRow] };
  } else {
    updateIdleExpeditionProgress(player);
    const exp = town.idleExpedition;
    const zone = IDLE_ZONES.find(z => z.id === exp.zoneId) || IDLE_ZONES[0];
    const now = Date.now();
    const elapsedMs = Math.min(now - exp.startTime, exp.durationMs);
    const remainingMs = Math.max(0, exp.durationMs - elapsedMs);
    const isFinished = remainingMs <= 0;

    const remainingMins = Math.ceil(remainingMs / 60000);

    const embed = new EmbedBuilder()
      .setColor(isFinished ? 0x2ECC71 : 0xF1C40F)
      .setTitle(`⏳ Status Ekspedisi AFK: ${zone.name}`)
      .setDescription(
        `Pasukan Anda sedang menjelajahi arena AFK dan mengumpulkan harta karun!\n\n` +
        `📌 **Status:** ${isFinished ? '✅ **EKSPEDISI SELESAI! (Siap Diklaim)**' : `⏳ **Sedang Berburu...** (Selesai dalam \`${remainingMins} menit\`)`}\n\n` +
        `🎁 **Hasil Buruan AFK Terkumpul:**\n` +
        `• ${EMOJIS.res_coin || '💰'} Koin: **+${exp.accumulatedRewards.coins.toLocaleString()} Coin**\n` +
        `• 💎 Gems: **+${exp.accumulatedRewards.gems} Gems**\n` +
        (exp.accumulatedRewards.wood ? `• ${EMOJIS.res_wood || '🪵'} Kayu: **+${exp.accumulatedRewards.wood}**\n` : '') +
        (exp.accumulatedRewards.iron ? `• ${EMOJIS.res_iron || '⚙️'} Besi: **+${exp.accumulatedRewards.iron}**\n` : '')
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_idle_claim_rewards').setLabel('🎁 Klaim Hasil Buruan AFK').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('town_main').setLabel('Kembali').setEmoji(EMOJIS.btn_back || '🔙').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }
}

export function handleIdleExpeditionAction(db: MinigameDB, player: PlayerInventory, action: string, userName: string): any {
  if (!player.town) return 'Kota tidak ditemukan.';

  const cleanAction = action.replace('town_', '');

  if (cleanAction.startsWith('idle_deploy_')) {
    const zoneId = cleanAction.replace('idle_deploy_', '');
    const zone = IDLE_ZONES.find(z => z.id === zoneId);
    if (!zone) return 'Zona tidak valid.';

    const totalTroops = (player.town.army?.infantry || 0) + (player.town.army?.archers || 0) + (player.town.army?.cavalry || 0) + (player.town.army?.spearmen || 0);
    if (totalTroops < zone.minTroops) {
      pushDashboardLog(player, `❌ Gagal Ekspedisi: Butuh minimal ${zone.minTroops} Prajurit.`);
      return renderIdleExpeditionMenu(player, userName);
    }

    player.town.idleExpedition = {
      zoneId: zone.id,
      zoneName: zone.name,
      startTime: Date.now(),
      durationMs: 4 * 3600000, // 4 hours AFK expedition
      troopsSent: {
        infantry: player.town.army?.infantry || 0,
        archers: player.town.army?.archers || 0,
        cavalry: player.town.army?.cavalry || 0,
        spearmen: player.town.army?.spearmen || 0
      },
      accumulatedRewards: {
        coins: 0,
        gems: 0,
        wood: 0,
        iron: 0,
        itemsFound: []
      }
    };

    pushDashboardLog(player, `⏳ BERANGKAT EKSPEDISI AFK! Pasukan menjelajahi ${zone.name} selama 4 jam.`);
    saveMinigameDB(db);
    return renderIdleExpeditionMenu(player, userName);
  }

  if (cleanAction === 'idle_claim_rewards') {
    if (!player.town.idleExpedition) {
      pushDashboardLog(player, `❌ Tidak ada hasil ekspedisi AFK untuk diklaim.`);
      return renderIdleExpeditionMenu(player, userName);
    }

    updateIdleExpeditionProgress(player);
    const exp = player.town.idleExpedition;
    const rewards = exp.accumulatedRewards;

    player.coins += rewards.coins;
    player.gems = (player.gems || 0) + rewards.gems;
    if (!player.materials) player.materials = {};
    if (rewards.wood) player.materials['Wood'] = (player.materials['Wood'] || 0) + rewards.wood;
    if (rewards.iron) player.materials['Iron'] = (player.materials['Iron'] || 0) + rewards.iron;

    const claimedMsg = `🎁 KLAIM AFK SUKSES! Mendapatkan +${rewards.coins.toLocaleString()} Coin, +${rewards.gems} Gems!`;
    pushDashboardLog(player, claimedMsg);

    delete player.town.idleExpedition;
    saveMinigameDB(db);
    return renderIdleExpeditionMenu(player, userName);
  }

  return renderIdleExpeditionMenu(player, userName);
}
