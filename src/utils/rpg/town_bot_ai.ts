import { loadMinigameDB, saveMinigameDB, getPlayer } from '../minigame';
import { handleTownAction, getLandPrice, BUILDING_COSTS, VILLAGER_COST_WLS, TIER_UPGRADES, usedSlots } from './town';
import { logger } from '../../logger';

/**
 * Executes one step of AI Town Management for a bot or persona user.
 */
export function runBotTownAI(db: any, botUserId: string, botName: string): string | null {
  const player = getPlayer(db, botUserId);
  const town = player.town!;

  // 1. Give bot starting resources if poor
  if ((player.coins || 0) < 5) {
    player.coins = (player.coins || 0) + 15;
  }
  if (!player.materials) player.materials = {};
  if ((player.materials['Wood'] || 0) < 20) {
    player.materials['Wood'] = 50;
  }

  // 2. Buy Land if maxed out on slots
  const slotsUsed = usedSlots(town);
  const totalSlots = town.landSlots * 4;

  if (totalSlots - slotsUsed < 2) {
    const price = getLandPrice(player);
    if ((player.coins || 0) >= price) {
      handleTownAction(db, player, 'buyland', botName);
      return `🏰 Bot **${botName}** baru saja membeli 1 Bidang Tanah Kota Baru!`;
    }
  }

  // 3. Build Houses if villager cap reached
  const maxV = town.buildings.houses * 2;
  if (town.villagers >= maxV && (player.coins || 0) >= BUILDING_COSTS.house.coins) {
    handleTownAction(db, player, 'build_house', botName);
    return `🏠 Bot **${botName}** membangun **Rumah Baru** di kotanya!`;
  }

  // 4. Recruit Villagers
  if (town.villagers < maxV && (player.coins || 0) >= VILLAGER_COST_WLS) {
    handleTownAction(db, player, 'recruit', botName);
    return `👥 Bot **${botName}** merekrut 1x **Villager Baru** untuk bekerja!`;
  }

  // 5. Build Farms / Wells / Quarries
  if (town.buildings.wells === 0 && (player.coins || 0) >= BUILDING_COSTS.well.coins) {
    handleTownAction(db, player, 'build_well', botName);
    return `🚰 Bot **${botName}** membangun **Sumur Kota** untuk suplai air!`;
  }

  if (town.buildings.farms < 3 && (player.coins || 0) >= BUILDING_COSTS.farm.coins) {
    handleTownAction(db, player, 'build_farm', botName);
    return `🌾 Bot **${botName}** membangun **Ladang Gandum** baru!`;
  }

  if ((town.buildings.quarries || 0) < 2 && (player.coins || 0) >= BUILDING_COSTS.quarry.coins) {
    handleTownAction(db, player, 'build_quarry', botName);
    return `⛏️ Bot **${botName}** membangun **Tambang Batu & Besi**!`;
  }

  // 6. Upgrade Tier if eligible
  const nextTier = town.tier + 1;
  if (nextTier <= 6 && TIER_UPGRADES[nextTier]) {
    const req = TIER_UPGRADES[nextTier];
    if (town.landSlots >= req.requiredLand && town.villagers >= req.requiredVillagers && (player.coins || 0) >= req.wlsRequired) {
      handleTownAction(db, player, 'upgrade', botName);
      return `⬆️ Bot **${botName}** menaikkan Kota miliknya ke **Tier ${town.tier}**!`;
    }
  }

  return null;
}
