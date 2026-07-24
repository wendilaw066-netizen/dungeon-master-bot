import { PlayerInventory, saveMinigameDB, MinigameDB } from '../minigame';
import { getJobBonusMultiplier } from './jobs';

export function handleEconomyBuy(db: MinigameDB, player: PlayerInventory, item: string, amount: number): string | null {
  amount = Math.max(1, isNaN(amount) ? 1 : amount);

  if (item === 'land' || item === 'tanah') {
    const cost = 20 * amount; // 20 DL per land
    if (player.coins < cost) return `Kurang modal! Beli ${amount} Tanah butuh **${cost} Coin**. Kamu cuma punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    player.economy.land += amount;
    saveMinigameDB(db);
    return `🗺️ Selamat! Kamu baru saja membeli **${amount} Hektar Tanah** seharga ${cost} DL. Kapasitas auto-farm bertambah!`;
  }
  
  if (item === 'worker' || item === 'pekerja' || item === 'budak') {
    const cost = 50 * amount; // 50 Coin per worker
    if (player.coins < cost) return `Kurang Coin! Sewa ${amount} Pekerja butuh **${cost} Coin**. Kamu cuma punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    player.economy.workers += amount;
    saveMinigameDB(db);
    return `👷 Kamu berhasil merekrut **${amount} Pekerja** seharga ${cost} Coin. Mereka akan farming Gems secara pasif untukmu!`;
  }
  
  if (item === 'livestock' || item === 'ternak') {
    const cost = 10 * amount; // 10 Coin per livestock
    if (player.coins < cost) return `Kurang Coin! Beli ${amount} Ternak butuh **${cost} Coin**.`;
    
    player.coins -= cost;
    player.economy.livestock += amount;
    saveMinigameDB(db);
    return `🐄 Berhasil membeli **${amount} Hewan Ternak** seharga ${cost} Coin. (Regenerasi HP & Gems pasif bertambah)`;
  }
  
  return null; // Not an economy item
}

export function calculateOfflinePassiveIncome(player: PlayerInventory, now: number): { coins: number, healed: boolean } {
  // Hitung berapa lama sejak terakhir farming
  const timeDiffMs = now - (player.lastFarmTime || 0);
  if (timeDiffMs < 60000) return { coins: 0, healed: false }; // Too soon
  
  const minutesPassed = Math.floor(timeDiffMs / 60000);
  const maxMinutes = 1440; // Max 24 hours calculation
  const effectiveMinutes = Math.min(minutesPassed, maxMinutes);
  
  // Upkeep Anti-Snowball Calculation
  let upkeepWlsPerHour = 0;
  if (player.economy.workers > 100) upkeepWlsPerHour = 5;
  else if (player.economy.workers > 50) upkeepWlsPerHour = 2;
  else if (player.economy.workers > 0) upkeepWlsPerHour = 1;
  
  let hoursPassed = Math.floor(effectiveMinutes / 60);
  let totalUpkeep = hoursPassed * upkeepWlsPerHour * player.economy.workers;
  
  if (totalUpkeep > 0) {
    if (player.coins >= totalUpkeep) {
      player.coins -= totalUpkeep;
      player.economy.workersStrike = false;
    } else {
      player.coins = 0; // Drain remaining
      player.economy.workersStrike = true; // Strike!
    }
  }

  // Base calculation
  // Workers give 1 Coin per minute
  // Land increases worker efficiency by 5% per land
  const baseCoinsPerMin = player.economy.workersStrike ? 0 : player.economy.workers;
  const landMultiplier = 1 + (player.economy.land * 0.05);
  
  // Job bonuses
  const jobBonuses = getJobBonusMultiplier(player);
  
  let passiveCoins = Math.floor(baseCoinsPerMin * landMultiplier * effectiveMinutes * jobBonuses.farm);
  
  // Livestock heals player slowly (1 HP per minute per livestock)
  let healed = false;
  if (player.economy.livestock > 0 && player.hp < player.maxHp) {
    const healAmount = player.economy.livestock * effectiveMinutes;
    player.hp += healAmount;
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    healed = true;
  }
  
  return { coins: passiveCoins, healed };
}
