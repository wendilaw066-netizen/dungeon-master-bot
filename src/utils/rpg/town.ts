import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';
import { pushDashboardLog } from './dashboard';
import { FACTIONS } from './factions';
import { renderAcademyMenu, handleResearchAction } from './research';
import { getFarmSeasonMultiplier, getCurrentSeason, getSeasonInfo } from './season';
import { renderGeneralsMenu, handleGeneralAction, getGeneralBuff } from './generals';
import { loadWorldDB } from './world';
import { renderMapMenu } from './map';
import { renderMarchMenu, handleMarchAction, processMarches } from './marches';

// ============================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================
export const TIER_NAMES = ['', 'Village', 'Town', 'City', 'Barony', 'Duchy', 'Kingdom'];
export const TIER_EMOJIS = [``, `🏡`, `🏘️`, `🏙️`, `👑`, `${EMOJIS.btn_shield}`, `👑`];

export const TIER_LAND_MAX = [0, 5, 10, 20, 40, 60, 999];
export const TIER_UPGRADES: Record<number, { requiredLand: number; requiredVillagers: number; wlsRequired: number }> = {
  2: { requiredLand: 3,  requiredVillagers: 5,   wlsRequired: 30  },
  3: { requiredLand: 8,  requiredVillagers: 15,  wlsRequired: 100 },
  4: { requiredLand: 15, requiredVillagers: 30,  wlsRequired: 300 },
  5: { requiredLand: 30, requiredVillagers: 60,  wlsRequired: 800 },
  6: { requiredLand: 50, requiredVillagers: 120, wlsRequired: 2000 },
};

export const TIER_TITLES: Record<number, string> = {
  4: 'Baron/Baroness',
  5: 'Duke/Duchess',
  6: 'King/Queen',
};

export function getCashflowField(player: PlayerInventory) {
  const { calculateHourlyCashflow } = require('./dashboard');
  const cf = calculateHourlyCashflow(player);
  const netStr = cf.netCoinFlow >= 0 ? `\`+${cf.netCoinFlow} Coin/jam\` ✅ (Untung)` : `\`${cf.netCoinFlow} Coin/jam\` ⚠️ (Defisit!)`;
  return {
    name: `📈 ESTIMASI ARUS KAS & LOGISTIK (PER JAM)`,
    value:
      `🟢 **Pendapatan (+):** \`+${cf.totalCoinIncome} Coin/jam\` (Pasar: +${cf.commerceCoins}, Pajak: +${cf.taxCoins}, Ekspor Surplus: +${cf.exportCoins})\n` +
      `🔴 **Pengeluaran (-):** \`-${cf.totalCoinExpense} Coin/jam\` (Lahan: -${cf.landTax}, Infra: -${cf.infraUpkeep}, Gaji Pasukan: -${cf.armyUpkeep})\n` +
      `⚖️ **Surplus Bersih:** ${netStr}\n` +
      `🌾 **Pangan/jam:** Beras \`+${cf.riceIncome}/-${cf.riceExpense}\` | Daging \`+${cf.meatIncome}/-${cf.meatExpense}\` | Kayu \`+${cf.woodIncome}/jam\``,
    inline: false
  };
}

// All buildings with their slots and min tier requirement
export const BUILDING_COSTS: Record<string, { coins: number; slots: number; minTier: number }> = {
  house:        { coins: 5,   slots: 1, minTier: 1 }, // Automatic level up cap up to 10 residents
  farm:         { coins: 5,   slots: 1, minTier: 1 }, // Produces Rice
  quarry:       { coins: 40,  slots: 1, minTier: 1 }, // Produces multi-metals (no wood)
  lumberMill:   { coins: 20,  slots: 1, minTier: 1 }, // Produces Wood
  ranch:        { coins: 15,  slots: 1, minTier: 2 }, // Livestock capacity
  tower:        { coins: 10,  slots: 1, minTier: 2 }, // Defense
  hospital:     { coins: 15,  slots: 1, minTier: 2 }, // Heal HP
  tavern:       { coins: 10,   slots: 1, minTier: 2 }, 
  school:       { coins: 15,  slots: 1, minTier: 2 }, // Public order booster
  inn:          { coins: 25,  slots: 1, minTier: 2 }, // Passive income generator
  academy:      { coins: 30,  slots: 1, minTier: 3 }, // Technology
  barrack:      { coins: 30,  slots: 1, minTier: 3 }, // Army Training Center
  stable:       { coins: 30,  slots: 1, minTier: 3 }, // Horses & Cavalry
  smithy:       { coins: 25,  slots: 1, minTier: 2 }, // Weapon blacksmith crafting
  marketplace:  { coins: 25,  slots: 1, minTier: 1 }, // Lowers poverty (upgradable to level 5)
  harbour:      { coins: 50,  slots: 1, minTier: 3 }, // Coastal trade income
  workshop:     { coins: 40,  slots: 1, minTier: 3 }, // Siege weapons crafting
  warehouse:    { coins: 10,  slots: 1, minTier: 1 }, // Storage capacity
  wonder:       { coins: 10000, slots: 1, minTier: 4 }, // World Wonder (1 BGL)
};

export const ANIMAL_COSTS: Record<string, { coins: number; requiredRanches: number }> = {
  chicken: { coins: 1, requiredRanches: 1 },
  goat:    { coins: 1, requiredRanches: 1 },
  cow:     { coins: 4, requiredRanches: 1 },
};

export const VILLAGER_COST_WLS = 1;

// ============================================================
// HELPERS
// ============================================================
export function formatCurrency(coins: number): string {
  if (coins === 0) return '0 Coin';
  let str = '';
  let bgls = 0, dls = 0, remWls = 0;
  
  if (coins >= 10000) {
    bgls = Math.floor(coins / 10000);
    coins %= 10000;
  }
  if (coins >= 100) {
    dls = Math.floor(coins / 100);
    coins %= 100;
  }
  remWls = coins;

  if (bgls > 0) str += `**${bgls} BGL** `;
  if (dls > 0) str += `**${dls} DL** `;
  if (remWls > 0 || (bgls === 0 && dls === 0)) str += `**${remWls} Coin**`;
  
  return str.trim();
}

export function usedSlots(t: NonNullable<PlayerInventory['town']>): number {
  let count = 0;
  for (const key of Object.keys(t.buildings)) {
    if (key !== 'archeryRanges') {
      count += (t.buildings as any)[key] || 0;
    }
  }
  return count;
}

function totalSlots(t: NonNullable<PlayerInventory['town']>): number {
  return t.landSlots;
}

function animalCapacity(t: NonNullable<PlayerInventory['town']>): number {
  return (t.buildings.ranches || 0) * 4;
}

function totalAnimals(t: NonNullable<PlayerInventory['town']>): number {
  return (t.animals.chickens || 0) + (t.animals.goats || 0) + (t.animals.cows || 0);
}

export function getLandPrice(player: PlayerInventory): number {
  const slots = player.town?.landSlots || 1;
  return 100 + (slots * 35);
}

// ============================================================
// TOWN PASSIVE SIMULATION & UPKEEP
// ============================================================
export function collectAnimalIncome(db: any, player: PlayerInventory): number {
  const town = player.town!;
  const now = Date.now();
  const msSinceLast = now - (town.lastAnimalIncome || 0);
  const minutesPassed = Math.floor(msSinceLast / 60000);
  if (minutesPassed < 1) return 0;

  // Initialize properties if missing
  if (!town.food) town.food = { rice: 20, milk: 10, meat: 10, egg: 5, wool: 5 };
  if (!town.weapons) town.weapons = { sword: 0, bow: 0, spear: 0, armor: 0 };
  if (town.horses === undefined) town.horses = 0;
  if (!town.peasantChildren) town.peasantChildren = [];
  if (town.povertyRate === undefined) town.povertyRate = 0;
  if (town.hungerRate === undefined) town.hungerRate = 0;

  let wlsEarned = 0;

  // GLOBAL STATE - World Disasters
  if (!db['GLOBAL_STATE']) db['GLOBAL_STATE'] = { coins: 0, items: {} };
  const globalState = db['GLOBAL_STATE'];
  if (!globalState.worldDisasters) globalState.worldDisasters = [];
  
  // Clean up expired disasters
  globalState.worldDisasters = globalState.worldDisasters.filter((d: any) => {
    return now < d.startMs + (d.durationMins * 60000);
  });

  // Spawn new disasters randomly (10% chance per tick if < 3 active)
  if (globalState.worldDisasters.length < 3 && Math.random() < 0.1) {
    const types: ('blizzard' | 'plague' | 'drought')[] = ['blizzard', 'plague', 'drought'];
    const type = types[Math.floor(Math.random() * types.length)];
    globalState.worldDisasters.push({
      id: 'D_' + Date.now() + Math.floor(Math.random()*1000),
      type,
      x: Math.floor(Math.random() * 101) - 50,
      y: Math.floor(Math.random() * 101) - 50,
      radius: Math.floor(Math.random() * 5) + 3, // 3 to 7
      durationMins: Math.floor(Math.random() * 60) + 30, // 30 to 90 mins
      startMs: now,
      vx: (Math.random() * 2 - 1) * 0.1, // slow movement
      vy: (Math.random() * 2 - 1) * 0.1
    });
  }

  // Faction discounts and bonuses
  const hasShu = player.faction === 'Shu';
  const hasWei = player.faction === 'Wei';
  const hasWu = player.faction === 'Wu';

  // Alliance Bonus
  const allianceCount = town.alliances ? town.alliances.length : 0;
  const allianceBonusMultiplier = 1 + (allianceCount * 0.10); // +10% per alliance

  // 1. Dynamic Public Order, Corruption
  if (town.tier >= 3) {
    if (!town.isTaxExempt) {
      const poDecay = Math.floor(minutesPassed / 2);
      if (poDecay > 0) {
        town.publicOrder = Math.max(-100, (town.publicOrder ?? 100) - poDecay);
      }
    } else {
      town.publicOrder = Math.min(100, (town.publicOrder ?? 100) + minutesPassed * 5);
    }
  }

  // 2. Child Growth Tick
  for (let i = town.peasantChildren.length - 1; i >= 0; i--) {
    town.peasantChildren[i].ticksLeft -= minutesPassed;
    if (town.peasantChildren[i].ticksLeft <= 0) {
      // Child matured to adult peasant
      town.villagers++;
      town.peasantChildren.splice(i, 1);
    }
  }

  // 3. Peasant Breeding Tick
  const housesCount = town.buildings.houses || 1;
  const currentTotalPop = town.villagers + town.peasantChildren.length;
  if (currentTotalPop < housesCount * 10) {
    const twoHourCycles = Math.floor(minutesPassed / 120);
    if (twoHourCycles > 0 && town.villagers >= 2) {
      // Distribute peasants to houses to see who breeds
      const housePop = Array.from({ length: housesCount }, () => ({ adults: 0, children: 0 }));
      for (let i = 0; i < town.villagers; i++) {
        housePop[i % housesCount].adults++;
      }
      for (let i = 0; i < town.peasantChildren.length; i++) {
        housePop[i % housesCount].children++;
      }

      for (let h = 0; h < housesCount; h++) {
        const totalInHouse = housePop[h].adults + housePop[h].children;
        if (housePop[h].adults >= 2 && totalInHouse < 10) {
          const maxSpawn = 10 - totalInHouse;
          const spawnCount = Math.min(twoHourCycles, maxSpawn);
          for (let s = 0; s < spawnCount; s++) {
            town.peasantChildren.push({ ticksLeft: 120 });
          }
        }
      }
    }
  }

  // 4. Commerce Income (Inn, Harbour, Marketplace)
  const innRate = (town.buildings.inns || 0) * 8; // 8 Coin per hour per inn
  const harbourRate = (town.buildings.harbours || 0) * 15; // 15 Coin per hour per harbour
  const marketRate = (town.buildings.marketplaces || 0) * 6 * (town.buildingLevels?.marketplace || 1); // 6 Coin per hour per market
  const tierCommerceMult = 1 + (((town.tier || 1) - 1) * 0.20); // +20% per Tier (up to 2.0x at Tier 6!)
  const hourlyIncome = (innRate + harbourRate + marketRate) * tierCommerceMult;
  const commerceBonus = hasWu ? 1.15 : 1.0;
  wlsEarned += Math.floor((hourlyIncome * (minutesPassed / 60)) * commerceBonus);

  // 5. Villager Tax
  if (!town.isTaxExempt) {
    const policy = (town as any).taxPolicy || 'normal';
    const policyMult = policy === 'light' ? 0.6 : (policy === 'heavy' ? 1.8 : 1.0);
    let taxWlPerMin = (town.villagers || 0) * 0.00833 * policyMult; // ~0.5 Coin per peasant/hr
    if (town.nobles) {
      taxWlPerMin += town.nobles * 0.0333; // 2 Coin per noble/hr
    }
    const taxWlEarned = Math.floor(taxWlPerMin * minutesPassed * 100) / 100;
    wlsEarned += taxWlEarned;
  }

  // 5b. Automated Resource Surplus Export (Ekspor Surplus Otomatis)
  if (minutesPassed > 0) {
    const woodHourly = (town.buildings.lumberMills || 0) * 8;
    const woodExportCoins = Math.floor(woodHourly / 10);

    const miningHourly = (town.buildings.quarries || 0) * 4;
    const miningExportCoins = Math.floor(miningHourly / 5);

    const exportCoinsPerHour = woodExportCoins + miningExportCoins;
    wlsEarned += Math.floor(exportCoinsPerHour * (minutesPassed / 60));
  }

  // CORRUPTION PENALTY (Anti-Snowball)
  if (town.landSlots > 10) {
    // 2% corruption per land slot above 10, up to 50% max. Reduced by schools.
    let corruptionPercent = (town.landSlots - 10) * 2;
    corruptionPercent -= (town.buildings.schools || 0) * 5; // Each school reduces 5%
    corruptionPercent = Math.max(0, Math.min(50, corruptionPercent));
    if (corruptionPercent > 0) {
      wlsEarned = Math.floor(wlsEarned * (1 - (corruptionPercent / 100)));
    }
  }

  // Apply Ruling Faction Bonus (Guild Wars)
  const worldDb = loadWorldDB();
  if (worldDb.rulingFaction && player.faction === worldDb.rulingFaction) {
    wlsEarned = Math.floor(wlsEarned * 1.1); // +10% Global Tax from Ruling
  }

  // 6. Food Production
  // Farms: 2 rice per 15 minutes per farm
  const farmCycles = minutesPassed / 15;
  if (farmCycles > 0 && town.buildings.farms > 0) {
    let farmYield = 1.0;
    if (town.research?.unlockedTechs?.includes('advancedFarming') || town.research?.advancedFarming) {
      farmYield = 1.2;
    }
    farmYield += getGeneralBuff(player, 'farm_yield'); // Add General buff
    farmYield *= getFarmSeasonMultiplier(); // Apply Season effect
    town.food.rice += Math.floor(farmCycles * 2 * town.buildings.farms * farmYield);
  }
  // Livestock production per 30 minutes
  const animalCycles = minutesPassed / 30;
  if (animalCycles > 0) {
    town.food.meat += animalCycles * (town.animals.chickens || 0);
    town.food.egg += animalCycles * (town.animals.chickens || 0);

    town.food.milk += animalCycles * (town.animals.goats || 0);
    town.food.wool += animalCycles * (town.animals.goats || 0);

    town.food.milk += animalCycles * 2 * (town.animals.cows || 0);
    town.food.meat += animalCycles * (town.animals.cows || 0);
  }

  // 7. Animal Breeding (passive every 1 hour, if 2 or more of a species exists)
  let breedCycles = Math.floor(minutesPassed / 60);
  if (town.research?.unlockedTechs?.includes('advancedFarming') || town.research?.advancedFarming) {
    breedCycles = Math.floor(minutesPassed / 45);
  }
  const maxAnimCap = animalCapacity(town);
  if (breedCycles > 0 && totalAnimals(town) < maxAnimCap) {
    for (let c = 0; c < breedCycles; c++) {
      if (totalAnimals(town) >= maxAnimCap) break;
      if (town.animals.chickens >= 2 && totalAnimals(town) < maxAnimCap) town.animals.chickens++;
      if (town.animals.goats >= 2 && totalAnimals(town) < maxAnimCap) town.animals.goats++;
      if (town.animals.cows >= 2 && totalAnimals(town) < maxAnimCap) town.animals.cows++;
    }
  }

  // 8. Lumber Mill & Quarry Production
  const lumberMillCycles = minutesPassed / 15;
  if (lumberMillCycles > 0 && (town.buildings.lumberMills || 0) > 0) {
    if (!player.materials) player.materials = {};
    player.materials['Wood'] = (player.materials['Wood'] || 0) + (lumberMillCycles * 2 * town.buildings.lumberMills!);
  }

  const quarryCount = town.buildings.quarries || 0;
  if (quarryCount > 0 && minutesPassed > 0) {
    const cycles = minutesPassed / 15;
    if (!player.materials) player.materials = {};
    
    const yieldMult = hasWei ? 1.10 : 1.0;
    const baseYield = cycles * quarryCount * yieldMult;

    player.materials['Copper'] = (player.materials['Copper'] || 0) + (baseYield * 0.50);
    player.materials['Iron'] = (player.materials['Iron'] || 0) + (baseYield * 0.35);
    player.materials['Silver'] = (player.materials['Silver'] || 0) + (baseYield * 0.12);
    player.materials['Gold'] = (player.materials['Gold'] || 0) + (baseYield * 0.03);
  }

  // 9. Stable passive horse production (1 horse per hour per stable)
  const stableCycles = minutesPassed / 60;
  if (stableCycles > 0 && (town.buildings.stables || 0) > 0) {
    town.horses += stableCycles * town.buildings.stables!;
  }

  // 10. School and Public Order Tick
  const schoolCount = town.buildings.schools || 0;
  if (schoolCount > 0) {
    town.publicOrder = Math.min(100, (town.publicOrder || 0) + schoolCount * (minutesPassed / 10));
  }

  const hospitalCount = town.buildings.hospitals || 0;
  if (hospitalCount > 0 && player.hp !== undefined) {
    let healRate = 1;
    if (town.research?.unlockedTechs?.includes('medicine')) healRate = 3; // Triple healing rate
    player.hp = Math.min(player.maxHp || 100, player.hp + Math.floor(hospitalCount * healRate * (minutesPassed / 15)));
  }

  // 11. Food Consumption & Hunger Ticks (Hourly)
  const hoursPassed = Math.floor(minutesPassed / 60);
  if (hoursPassed > 0) {
    // Consumption calculation
    const peasantUpkeepFood = town.villagers * 0.05 * hoursPassed;
    const armyCount = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.cavalry || 0);
    const armyUpkeepFood = armyCount * 0.10 * hoursPassed;
    const totalRiceNeeded = peasantUpkeepFood + armyUpkeepFood;

    const totalMeatNeeded = armyCount * 0.05 * hoursPassed;
    const totalMilkNeeded = armyCount * 0.05 * hoursPassed;

    if (town.food.rice >= totalRiceNeeded && town.food.meat >= totalMeatNeeded && town.food.milk >= totalMilkNeeded) {
      // Consumption successful
      town.food.rice -= Math.ceil(totalRiceNeeded);
      town.food.meat -= Math.ceil(totalMeatNeeded);
      town.food.milk -= Math.ceil(totalMilkNeeded);
      
      // Happy bonus
      town.publicOrder = Math.min(100, (town.publicOrder || 0) + 3 * hoursPassed);
      town.hungerRate = Math.max(0, town.hungerRate - 15 * hoursPassed);
    } else {
      // Starving!
      town.hungerRate = Math.min(100, town.hungerRate + 20 * hoursPassed);
      town.publicOrder = Math.max(-100, (town.publicOrder || 0) - 15 * hoursPassed);

      if (town.hungerRate >= 80) {
        // People die from starvation
        const deaths = Math.min(town.villagers - 2, Math.floor(hoursPassed));
        if (deaths > 0) {
          town.villagers -= deaths;
          pushDashboardLog(player, `🚨 STARVATION WARNING: ${deaths} peasants have died due to hunger!`);
        }
      }
    }
  }

  // 12. Hourly Upkeep Payment (Coin/Meat deduction) & Storage Limits
  const lastUpkeep = player.lastUpkeepPaid || (now - 3600000); // Default to 1 hour ago if missing
  const msSinceUpkeep = now - lastUpkeep;
  const upkeepHoursPassed = msSinceUpkeep / 3600000;
  
  if (upkeepHoursPassed >= 1) {
    const fullHours = Math.floor(upkeepHoursPassed);
    const basicArmyCount = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.spearmen || 0);
    const cavalryCount = (town.army?.cavalry || 0);
    const catapultCount = (town.army?.catapults || 0);
    
    // Basic infantry: 1 Coin per 10 troops
    let basicUpkeepCost = Math.floor(basicArmyCount / 10) * fullHours;
    // Cavalry: 1 Coin + 3 Meat per unit per hour
    let cavCoinCost = cavalryCount * 1 * fullHours;
    let cavMeatCost = cavalryCount * 3 * fullHours;
    // Catapult: 5 Wood per unit per hour
    let catapultWoodCost = catapultCount * 5 * fullHours;

    const slots = town.landSlots || 1;
    const landTaxPerHour = slots <= 10 ? (slots * 0.2) : (2 + (slots - 10) * 0.5);
    const landTax = Math.floor(landTaxPerHour * fullHours);
    const infraUpkeep = Math.floor((town.villagers || 0) / 10) * fullHours;
    let totalCoinCost = basicUpkeepCost + cavCoinCost + landTax + infraUpkeep;

    if (totalCoinCost > 0 || cavMeatCost > 0 || catapultWoodCost > 0) {
      let paid = true;
      if (player.coins >= totalCoinCost) player.coins -= totalCoinCost; else paid = false;
      if (town.food.meat >= cavMeatCost) town.food.meat -= cavMeatCost; else paid = false;
      if (!player.materials) player.materials = {};
      if ((player.materials['Wood'] || 0) >= catapultWoodCost) player.materials['Wood'] -= catapultWoodCost; else paid = false;

      if (paid) {
        pushDashboardLog(player, `💸 Logistik Dibayar: ${totalCoinCost} Koin, ${cavMeatCost} Daging, ${catapultWoodCost} Kayu (${fullHours} jam).`);
      } else {
        player.coins = Math.max(0, player.coins - totalCoinCost);
        town.food.meat = Math.max(0, town.food.meat - cavMeatCost);
        if (player.materials['Wood']) player.materials['Wood'] = Math.max(0, player.materials['Wood'] - catapultWoodCost);
        
        town.morale = Math.max(0, (town.morale || 100) - (fullHours * 15));
        town.publicOrder = Math.max(-100, (town.publicOrder || 100) - (fullHours * 20));
        
        // Desertion & Plundering
        let plunderLog = '';
        if (town.army) {
          const totalArmy = (town.army.cavalry || 0) + (town.army.infantry || 0) + (town.army.archers || 0);
          if (totalArmy > 0 && Math.random() < 0.5) {
             const stolenCoins = Math.floor(Math.random() * 50) + 10;
             if (player.coins >= stolenCoins) {
                 player.coins -= stolenCoins;
                 town.publicOrder = Math.max(-100, town.publicOrder - 30);
                 plunderLog = ` ⚠️ Pasukan yang kelaparan menjarah ${stolenCoins} Koin dari kotamu sebelum desersi!`;
             }
          }
          if ((town.army.cavalry || 0) > 0) town.army.cavalry = Math.floor(town.army.cavalry * 0.8);
          if ((town.army.catapults || 0) > 0) town.army.catapults = Math.floor((town.army.catapults || 0) * 0.8);
          if ((town.army.infantry || 0) > 0) town.army.infantry = Math.floor(town.army.infantry * 0.9);
        }
        pushDashboardLog(player, `🚨 GAGAL BAYAR LOGISTIK! Kas/Daging/Kayu kosong! Pasukan desersi dan moral hancur.${plunderLog}`);
      }
    }
    player.lastUpkeepPaid = now - (msSinceUpkeep % 3600000); // Keep the remainder
  }

  // ENFORCE STORAGE LIMITS
  const storageCap = 500 + ((town.buildings.warehouses || 0) * 1000);
  if (player.materials) {
    if (player.materials['Wood'] > storageCap) player.materials['Wood'] = storageCap;
    if (player.materials['Iron'] > storageCap) player.materials['Iron'] = storageCap;
    if (player.materials['Copper'] > storageCap) player.materials['Copper'] = storageCap;
  }
  if (town.food.rice > storageCap) town.food.rice = storageCap;
  if (town.food.meat > storageCap) town.food.meat = storageCap;

  // 13. Random Disasters (Chance per hour)
  if (hoursPassed > 0 && Math.random() < (0.01 * hoursPassed)) {
    const disasters = [
      { id: 'plague', name: 'Wabah Penyakit', effect: () => {
        let dmg = 50;
        if (town.research?.unlockedTechs?.includes('medicine')) dmg = 10;
        if (player.hp !== undefined) player.hp = Math.max(1, player.hp - dmg);
        town.morale = Math.max(0, (town.morale || 100) - 20);
        pushDashboardLog(player, `⛈️ BENCANA: ${dmg === 10 ? 'Wabah diredakan oleh Herbal Medicine (-10 HP)' : 'Wabah penyakit parah menyerang kota! (-50 HP, -20 Morale)'}`);
      }},
      { id: 'bandit', name: 'Serangan Bandit', effect: () => {
        const wlsStolen = Math.floor(player.coins * 0.05);
        player.coins = Math.max(0, player.coins - wlsStolen);
        town.publicOrder = Math.max(-100, (town.publicOrder || 100) - 15);
        pushDashboardLog(player, `⛈️ BENCANA: Bandit liar merampok kota! (-${wlsStolen} Coin, -15 Keamanan)`);
      }}
    ];
    const d = disasters[Math.floor(Math.random() * disasters.length)];
    d.effect();
    town.activeDisaster = d.name;
  } else if (hoursPassed > 0 && town.activeDisaster) {
    town.activeDisaster = null; // Clear after an hour
  }

  // 14. Poverty Calculation
  const workplaceSlots = 
    (town.buildings.farms * 2) + 
    ((town.buildings.lumberMills || 0) * 2) + 
    ((town.buildings.quarries || 0) * 2) + 
    ((town.buildings.smithies || 0) * 2) + 
    ((town.buildings.stables || 0) * 2) + 
    ((town.buildings.marketplaces || 0) * 5 * (town.buildingLevels?.marketplace || 1)) +
    ((town.buildings.harbours || 0) * 4) +
    ((town.buildings.inns || 0) * 3) +
    ((town.buildings.schools || 0) * 2);

  town.povertyRate = Math.max(0, town.villagers - workplaceSlots);
  if (town.povertyRate > 0) {
    town.publicOrder = Math.max(-100, (town.publicOrder || 0) - (town.povertyRate * (minutesPassed / 60) * 0.1));
  }
  
  // Apply alliance bonus multiplier
  wlsEarned = Math.floor(wlsEarned * (town.alliances ? (1 + town.alliances.length * 0.10) : 1));

  if (wlsEarned > 0) player.coins += wlsEarned;
  town.lastAnimalIncome = now;
  
  // -- DISASTER EFFECTS --
  if (town.location && globalState.worldDisasters && globalState.worldDisasters.length > 0) {
     for (const d of globalState.worldDisasters) {
        // Calculate current position of disaster
        const d_elapsedMins = (now - d.startMs) / 60000;
        const curX = d.x + (d.vx * d_elapsedMins);
        const curY = d.y + (d.vy * d_elapsedMins);
        
        const dist = Math.sqrt(Math.pow(town.location.x - curX, 2) + Math.pow(town.location.y - curY, 2));
        if (dist <= d.radius) {
           // We are in a disaster zone!
           const effectTicks = Math.min(minutesPassed, Math.floor((now - d.startMs) / 60000));
           if (effectTicks > 0) {
              if (d.type === 'plague') {
                 // 1% villagers die per 10 mins
                 const deathRate = 0.01 * (effectTicks / 10);
                 const died = Math.floor(town.villagers * deathRate);
                 if (died > 0) town.villagers = Math.max(0, town.villagers - died);
                 town.publicOrder = Math.max(-100, (town.publicOrder || 0) - (effectTicks / 2));
              } else if (d.type === 'drought') {
                 // Hunger increases massively
                 town.hungerRate = Math.min(100, (town.hungerRate || 0) + effectTicks);
              } else if (d.type === 'blizzard') {
                 // Army suffers attrition, no profit
                 if (town.army) {
                    const attrition = 0.02 * (effectTicks / 10); // 2% per 10 mins
                    town.army.infantry = Math.floor(town.army.infantry * (1 - attrition));
                    town.army.archers = Math.floor(town.army.archers * (1 - attrition));
                 }
                 player.coins = Math.max(0, player.coins - wlsEarned); // Cancel all profits for this tick!
                 wlsEarned = 0;
              }
           }
        }
     }
  }

  // Process any returning/arrived marches (now done via processMarches inside town tick, passing DB)
  const { processMarches } = require('./marches');
  processMarches(db, player);
  
  return wlsEarned;
}

// ============================================================
// RENDER INTERFACES
// ============================================================
export function renderTownMenu(player: PlayerInventory, userName: string, db: any, currentTab?: string) {
  const { renderDashboard } = require('./dashboard');
  return renderDashboard(player, userName);
}

// ============================================================
// ACTIONS HANDLER
// ============================================================
export async function handleTownAction(db: any, player: PlayerInventory, action: string, userName: string, guild: any = null): Promise<any> {
  const town = player.town!;
  const tier = town.tier;

  // ── BUY LAND ──
  if (action === 'buyland') {
    const cost = getLandPrice(player);
    if (player.coins < cost) {
      pushDashboardLog(player, `❌ Gagal beli lahan: Butuh ${cost} Coin.`);
    } else {
      player.coins -= cost;
      town.landSlots++;
      pushDashboardLog(player, `🗺️ Berhasil membeli 1 Lahan Baru seharga ${cost} Coin! (Total: ${town.landSlots} Slot)`);
    }
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db);
  }

  // ── RECRUIT PEASANT ──
  if (action === 'recruit_peasant') {
    const houseCap = (town.buildings.houses || 0) * 10;
    if (town.villagers >= houseCap) {
      pushDashboardLog(player, `❌ Populasi penuh (${town.villagers}/${houseCap})! Bangun Rumah untuk menambah kapasitas.`);
    } else if (player.coins < VILLAGER_COST_WLS) {
      pushDashboardLog(player, `❌ Gagal rekrut warga: Butuh ${VILLAGER_COST_WLS} Coin per warga.`);
    } else {
      player.coins -= VILLAGER_COST_WLS;
      town.villagers++;
      pushDashboardLog(player, `👨‍🌾 Berhasil merekrut 1 Warga baru seharga ${VILLAGER_COST_WLS} Coin!`);
    }
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db);
  }

  // ── CLAIM PROFIT ──
  if (action === 'claim_profit') {
    pushDashboardLog(player, `💰 Kas pajak dan hasil ekspor surplus telah diklaim ke perbendaharaan kota!`);
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db);
  }

  // ── UPGRADE TIER ──
  if (action === 'upgrade') {
    const nextTier = tier + 1;
    const req = (TIER_UPGRADES as any)[nextTier];
    if (!req) {
      pushDashboardLog(player, `👑 Kerajaan Anda telah mencapai Tier Maksimum!`);
    } else {
      const costCoins = req.wlsRequired || 500;
      const reqVillagers = req.requiredVillagers || 20;
      const reqLand = req.requiredLand || 10;

      if (player.coins < costCoins || town.villagers < reqVillagers || town.landSlots < reqLand) {
        pushDashboardLog(player, `❌ Syarat Tier ${nextTier} belum terpenuhi! Butuh ${costCoins} Coin, ${reqVillagers} Warga, ${reqLand} Lahan.`);
      } else {
        player.coins -= costCoins;
        town.tier = nextTier;
        pushDashboardLog(player, `🎉 SELAMAT! Kerajaan Anda berhasil naik ke Tier ${nextTier}!`);
      }
    }
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db);
  }

  // ── BUILD MENU (MENU KONSTRUKSI BANGUNAN) ──
  if (action === 'build_menu') {
    const used = usedSlots(town);
    const total = town.landSlots;
    const free = total - used;

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🏗️ Menu Konstruksi Bangunan Kota — ${userName}`)
      .setDescription(
        `Pilih bangunan yang ingin didirikan di kota Anda.\n` +
        `• **Sisa Lahan Bebas:** \`${free} / ${total} Slot\`\n` +
        `• **Kas Koin:** \`${player.coins} Coin\`\n\n` +
        `🏠 **Rumah** (Cost: 10 Coin) — +10 Kapasitas Populasi Warga\n` +
        `🌾 **Ladang** (Cost: 15 Coin) — Produksi Beras Pangan\n` +
        `🐄 **Peternakan** (Cost: 20 Coin) — Tempat Memelihara Ternak\n` +
        `🪵 **Kilang Kayu** (Cost: 25 Coin) — Produksi Kayu & Ekspor\n` +
        `⛏️ **Tambang** (Cost: 30 Coin) — Produksi Besi/Tembaga/Emas\n` +
        `🏬 **Pasar** (Cost: 40 Coin) — Perdagangan & Pendapatan Koin (+6/hr)\n` +
        `⚒️ **Pandai Besi** (Cost: 50 Coin) — Penempaan Senjata Pasukan\n` +
        `🍻 **Penginapan** (Cost: 60 Coin) — Pajak Turis (+8/hr)\n` +
        `⛵ **Pelabuhan** (Cost: 100 Coin) — Perdagangan Laut (+15/hr)\n` +
        `🐎 **Kandang Kuda** (Cost: 80 Coin) — Tempat Latih Kavaleri\n` +
        `🏥 **Rumah Sakit** (Cost: 70 Coin) — Pemulihan HP Pemimpin\n` +
        `🏫 **Sekolah** (Cost: 75 Coin) — Menjaga Keamanan & Mengurangi Korupsi\n` +
        `🛡️ **Tower** (Cost: 90 Coin) — Pertahanan Kota (+25 Atk)\n` +
        `⚙️ **Workshop** (Cost: 100 Coin) — Produksi Siege Catapult\n` +
        `📦 **Gudang** (Cost: 50 Coin) — +1.000 Kapasitas Penyimpanan`
      )
      .addFields(getCashflowField(player));

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_build_house').setLabel('Rumah (10c)').setEmoji('🏠').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 10),
      new ButtonBuilder().setCustomId('town_build_farm').setLabel('Ladang (15c)').setEmoji('🌾').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 15),
      new ButtonBuilder().setCustomId('town_build_ranch').setLabel('Peternakan (20c)').setEmoji('🐄').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 20),
      new ButtonBuilder().setCustomId('town_build_lumberMill').setLabel('Kilang Kayu (25c)').setEmoji('🪵').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 25),
      new ButtonBuilder().setCustomId('town_build_quarry').setLabel('Tambang (30c)').setEmoji('⛏️').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 30)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_build_marketplace').setLabel('Pasar (40c)').setEmoji('🏬').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 40),
      new ButtonBuilder().setCustomId('town_build_smithy').setLabel('Smithy (50c)').setEmoji('⚒️').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 50),
      new ButtonBuilder().setCustomId('town_build_inn').setLabel('Penginapan (60c)').setEmoji('🍻').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 60),
      new ButtonBuilder().setCustomId('town_build_harbour').setLabel('Pelabuhan (100c)').setEmoji('⛵').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 100),
      new ButtonBuilder().setCustomId('town_build_stable').setLabel('Kuda (80c)').setEmoji('🐎').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 80)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_build_hospital').setLabel('Rumah Sakit (70c)').setEmoji('🏥').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 70),
      new ButtonBuilder().setCustomId('town_build_school').setLabel('Sekolah (75c)').setEmoji('🏫').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 75),
      new ButtonBuilder().setCustomId('town_build_tower').setLabel('Tower (90c)').setEmoji('🛡️').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 90),
      new ButtonBuilder().setCustomId('town_build_workshop').setLabel('Workshop (100c)').setEmoji('⚙️').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 100),
      new ButtonBuilder().setCustomId('town_build_warehouse').setLabel('Gudang (50c)').setEmoji('📦').setStyle(ButtonStyle.Success).setDisabled(free < 1 || player.coins < 50)
    );

    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_destroy_menu').setLabel('Hancurkan Bangunan').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('town_main').setLabel('Kembali ke Utama').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, row3, row4] };
  }

  // ── DESTROY MENU ──
  if (action === 'destroy_menu') {
    const b = town.buildings;
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🗑️ Pembongkaran Bangunan Kota')
      .setDescription(
        `Pilih bangunan yang ingin dihancurkan untuk mengosongkan slot lahan:\n\n` +
        `• 🏠 Rumah: \`${b.houses || 0}\` unit\n` +
        `• 🌾 Ladang: \`${b.farms || 0}\` unit\n` +
        `• 🐄 Peternakan: \`${b.ranches || 0}\` unit\n` +
        `• 🪵 Kilang Kayu: \`${b.lumberMills || 0}\` unit\n` +
        `• ⛏️ Tambang: \`${b.quarries || 0}\` unit\n` +
        `• 🏬 Pasar: \`${b.marketplaces || 0}\` unit\n` +
        `• ⚒️ Pandai Besi: \`${b.smithies || 0}\` unit\n` +
        `• 📦 Gudang: \`${b.warehouses || 0}\` unit`
      )
      .addFields(getCashflowField(player));

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_demolish_houses').setLabel('Hancurkan Rumah').setEmoji('🏠').setStyle(ButtonStyle.Danger).setDisabled((b.houses || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_farms').setLabel('Hancurkan Ladang').setEmoji('🌾').setStyle(ButtonStyle.Danger).setDisabled((b.farms || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_ranches').setLabel('Hancurkan Ternak').setEmoji('🐄').setStyle(ButtonStyle.Danger).setDisabled((b.ranches || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_lumberMills').setLabel('Hancurkan Kayu').setEmoji('🪵').setStyle(ButtonStyle.Danger).setDisabled((b.lumberMills || 0) <= 0)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_demolish_quarries').setLabel('Hancurkan Tambang').setEmoji('⛏️').setStyle(ButtonStyle.Danger).setDisabled((b.quarries || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_marketplaces').setLabel('Hancurkan Pasar').setEmoji('🏬').setStyle(ButtonStyle.Danger).setDisabled((b.marketplaces || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_smithies').setLabel('Hancurkan Smithy').setEmoji('⚒️').setStyle(ButtonStyle.Danger).setDisabled((b.smithies || 0) <= 0),
      new ButtonBuilder().setCustomId('town_demolish_warehouses').setLabel('Hancurkan Gudang').setEmoji('📦').setStyle(ButtonStyle.Danger).setDisabled((b.warehouses || 0) <= 0)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_build_menu').setLabel('Kembali ke Menu Bangun').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
  }

  // ── BUILD SPECIFIC BUILDING ──
  if (action.startsWith('build_')) {
    const rawType = action.replace('build_', '');
    const keyMap: Record<string, keyof typeof town.buildings> = {
      house: 'houses',
      farm: 'farms',
      ranch: 'ranches',
      lumberMill: 'lumberMills',
      quarry: 'quarries',
      marketplace: 'marketplaces',
      smithy: 'smithies',
      inn: 'inns',
      harbour: 'harbours',
      stable: 'stables',
      hospital: 'hospitals',
      school: 'schools',
      tower: 'towers',
      workshop: 'workshops',
      warehouse: 'warehouses'
    };

    const bType = keyMap[rawType] || (rawType as keyof typeof town.buildings);
    const costInfo = (BUILDING_COSTS as any)[rawType] || { coins: 20 };
    const costCoin = costInfo.coins || 20;

    const used = usedSlots(town);
    if (used >= town.landSlots) {
      pushDashboardLog(player, `❌ Lahan Penuh! Beli Lahan baru terlebih dahulu.`);
    } else if (player.coins < costCoin) {
      pushDashboardLog(player, `❌ Kas Tidak Cukup! Membangun ${rawType} membutuhkan ${costCoin} Coin.`);
    } else {
      player.coins -= costCoin;
      (town.buildings as any)[bType] = ((town.buildings as any)[bType] || 0) + 1;
      pushDashboardLog(player, `🏗️ Berhasil membangun **${rawType.toUpperCase()}** seharga ${costCoin} Coin!`);
    }
    saveMinigameDB(db);
    return handleTownAction(db, player, 'build_menu', userName, guild);
  }

  // ── DEMOLISH BUILDING ──
  if (action.startsWith('demolish_')) {
    const rawType = action.replace('demolish_', '');
    const keyMap: Record<string, keyof typeof town.buildings> = {
      houses: 'houses',
      farms: 'farms',
      ranches: 'ranches',
      lumberMills: 'lumberMills',
      quarries: 'quarries',
      marketplaces: 'marketplaces',
      smithies: 'smithies',
      warehouses: 'warehouses'
    };
    const bType = keyMap[rawType] || (rawType as keyof typeof town.buildings);

    if (((town.buildings as any)[bType] || 0) > 0) {
      (town.buildings as any)[bType]--;
      pushDashboardLog(player, `🗑️ Berhasil menghancurkan 1 unit **${rawType.toUpperCase()}**! Lahan dibebaskan.`);
    } else {
      pushDashboardLog(player, `❌ Tidak ada unit **${rawType.toUpperCase()}** yang bisa dihancurkan!`);
    }
    saveMinigameDB(db);
    return handleTownAction(db, player, 'destroy_menu', userName, guild);
  }

  // 🥷 ARMY MENU 🥷
  if (action === 'army') {
    const army = town.army || { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 };
    const w = town.weapons || { sword: 0, bow: 0, spear: 0, armor: 0 };

    const totalPower = (army.infantry * 10) + (army.archers * 15) + (army.cavalry * 30) + ((army.spearmen || 0) * 12) + ((army.catapults || 0) * 50);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle(`${EMOJIS.bld_barracks || '🏰'} Barak Militer & Komando Pasukan - ${userName}`)
      .setDescription(
        `Kelola kesiapan tempur prajurit Anda untuk mempertahankan benteng atau melancarkan ekspedisi penaklukan:\n\n` +
        `⚡ **TOTAL ATTACK POWER:** \`${totalPower.toLocaleString()} ATK\`\n\n` +
        `${EMOJIS.unit_infantry || '🗡️'} **Infantri:** \`${army.infantry}\` Prajurit (Stok Pedang: \`${w.sword}\`)\n` +
        `${EMOJIS.unit_archer || '🏹'} **Archer:** \`${army.archers}\` Prajurit (Stok Busur: \`${w.bow}\`)\n` +
        `${EMOJIS.unit_spear || '🔱'} **Spearman:** \`${army.spearmen || 0}\` Prajurit (Stok Tombak: \`${w.spear}\`)\n` +
        `${EMOJIS.unit_cavalry || '🐎'} **Kavaleri:** \`${army.cavalry}\` Prajurit (Butuh Kuda & Zirah)\n` +
        `${EMOJIS.unit_catapult || '💣'} **Ketapel Perang:** \`${army.catapults || 0}\` Unit (Penghancur Benteng)`
      )
      .addFields(getCashflowField(player));

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_train_infantry').setLabel('Latih Infantri').setEmoji(EMOJIS.unit_infantry || '🗡️').setStyle(ButtonStyle.Success).setDisabled(w.sword <= 0),
      new ButtonBuilder().setCustomId('town_train_archer').setLabel('Latih Archer').setEmoji(EMOJIS.unit_archer || '🏹').setStyle(ButtonStyle.Success).setDisabled(w.bow <= 0),
      new ButtonBuilder().setCustomId('town_train_spearman').setLabel('Latih Spearman').setEmoji(EMOJIS.unit_spear || '🔱').setStyle(ButtonStyle.Success).setDisabled(w.spear <= 0),
      new ButtonBuilder().setCustomId('town_train_cavalry').setLabel('Latih Kavaleri').setEmoji(EMOJIS.unit_cavalry || '🐎').setStyle(ButtonStyle.Success).setDisabled((town.horses || 0) <= 0)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_forge_sword').setLabel('Tempa Pedang (5 Besi)').setEmoji(EMOJIS.bld_smithy || '🛠️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('town_forge_bow').setLabel('Tempa Busur (5 Kayu)').setEmoji(EMOJIS.res_wood || '🪵').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('town_forge_spear').setLabel('Tempa Tombak (5 Kayu)').setEmoji(EMOJIS.res_wood || '🪵').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('town_main').setLabel('Kembali').setEmoji(EMOJIS.btn_back || '🔙').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
  }

  // ── TRAIN SOLDIER ──
  if (action.startsWith('train_')) {
    const type = action.replace('train_', '');
    if (!town.army) town.army = { infantry: 0, archers: 0, cavalry: 0, spearmen: 0 };
    if (!town.weapons) town.weapons = { sword: 0, bow: 0, spear: 0, armor: 0 };

    if (type === 'infantry') {
      if (town.weapons.sword > 0) {
        town.weapons.sword--;
        town.army.infantry++;
        pushDashboardLog(player, `🥷 Berhasil melatih 1 Prajurit Infantri!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Stok Pedang kosong! Tempa Pedang terlebih dahulu.`);
      }
    } else if (type === 'archer') {
      if (town.weapons.bow > 0) {
        town.weapons.bow--;
        town.army.archers++;
        pushDashboardLog(player, `🏹 Berhasil melatih 1 Prajurit Archer!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Stok Busur kosong! Tempa Busur terlebih dahulu.`);
      }
    } else if (type === 'spearman') {
      if (town.weapons.spear > 0) {
        town.weapons.spear--;
        town.army.spearmen = (town.army.spearmen || 0) + 1;
        pushDashboardLog(player, `🔱 Berhasil melatih 1 Prajurit Spearman!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Stok Tombak kosong! Tempa Tombak terlebih dahulu.`);
      }
    } else if (type === 'cavalry') {
      if ((town.horses || 0) > 0) {
        town.horses = (town.horses || 0) - 1;
        town.army.cavalry++;
        pushDashboardLog(player, `🐎 Berhasil melatih 1 Prajurit Kavaleri!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Tidak ada Kuda yang tersedia! Bangun Stable.`);
      }
    }
    saveMinigameDB(db);
    return handleTownAction(db, player, 'army', userName, guild);
  }

  // ── FORGE WEAPONS ──
  if (action.startsWith('forge_')) {
    const type = action.replace('forge_', '');
    if (!player.materials) player.materials = {};
    if (!town.weapons) town.weapons = { sword: 0, bow: 0, spear: 0, armor: 0 };

    if (type === 'sword') {
      if ((player.materials['Iron'] || 0) >= 5) {
        player.materials['Iron'] -= 5;
        town.weapons.sword++;
        pushDashboardLog(player, `🗡️ Berhasil menempa 1 Pedang dari 5 Besi!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Butuh 5 Besi untuk menempa Pedang.`);
      }
    } else if (type === 'bow') {
      if ((player.materials['Wood'] || 0) >= 5) {
        player.materials['Wood'] -= 5;
        town.weapons.bow++;
        pushDashboardLog(player, `🏹 Berhasil menempa 1 Busur dari 5 Kayu!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Butuh 5 Kayu untuk menempa Busur.`);
      }
    } else if (type === 'spear') {
      if ((player.materials['Wood'] || 0) >= 5) {
        player.materials['Wood'] -= 5;
        town.weapons.spear++;
        pushDashboardLog(player, `🔱 Berhasil menempa 1 Tombak dari 5 Kayu!`);
      } else {
        pushDashboardLog(player, `❌ Gagal: Butuh 5 Kayu untuk menempa Tombak.`);
      }
    }
    saveMinigameDB(db);
    return handleTownAction(db, player, 'army', userName, guild);
  }

  if (action.startsWith('buy_animal_')) {
    const animalType = action.replace('buy_animal_', '');
    const cap = animalCapacity(town);
    const curr = totalAnimals(town);
    if (curr >= cap) {
      pushDashboardLog(player, `❌ Gagal beli hewan: Peternakan penuh (${curr}/${cap})!`);
    } else {
      const cost = animalType === 'cow' ? 4 : 1;
      if (player.coins < cost) {
        pushDashboardLog(player, `❌ Gagal beli ${animalType}: Koin tidak cukup (${cost} Coin).`);
      } else {
        player.coins -= cost;
        if (!town.animals) town.animals = { chickens: 0, goats: 0, cows: 0 };
        if (animalType === 'chicken') town.animals.chickens = (town.animals.chickens || 0) + 1;
        if (animalType === 'goat') town.animals.goats = (town.animals.goats || 0) + 1;
        if (animalType === 'cow') town.animals.cows = (town.animals.cows || 0) + 1;
      }
    }
    saveMinigameDB(db);
    return handleTownAction(db, player, 'animals', userName, guild);
  }
  if (action === 'toggle_auto') {
    player.isAuto = !player.isAuto;
    pushDashboardLog(player, player.isAuto ? `🤖 Auto Play Diaktifkan! AI Otomatis mengurus kota Anda.` : `🤖 Auto Play Dimatikan. Anda mengambil alih pemerintahan.`);
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db);
  }

  // ── ACADEMY & RESEARCH ──
  if (action === 'research') {
    if (!town.buildings.academies) {
      pushDashboardLog(player, `❌ Anda belum membangun Academy! Bangun di menu Konstruksi terlebih dahulu.`);
      return renderTownMenu(player, userName, db);
    }
    return renderAcademyMenu(player, userName, db);
  }
  if (action.startsWith('research_')) {
    if (!town.buildings.academies) {
      pushDashboardLog(player, `❌ Academy Anda belum dibangun!`);
      return renderTownMenu(player, userName, db);
    }
    return handleResearchAction(player, action, db);
  }

  // ── HEROES / GENERALS ──
  if (action === 'generals') return renderGeneralsMenu(player, userName, db);
  if (action.startsWith('gacha_general') || action.startsWith('equip_general_')) return handleGeneralAction(player, action, db);

  // ── MAP & MARCHES ──
  if (action === 'map') {
    if (!town.location) town.location = { x: Math.floor(Math.random() * 100) - 50, y: Math.floor(Math.random() * 100) - 50 };
    return await renderMapMenu(player, userName, db, town.location.x, town.location.y);
  }
  if (action.startsWith('map_pan_')) {
    const parts = action.split('_');
    const vx = parseInt(parts[2]);
    const vy = parseInt(parts[3]);
    return await renderMapMenu(player, userName, db, vx, vy);
  }
  if (action === 'map_center') {
    if (!town.location) town.location = { x: Math.floor(Math.random() * 100) - 50, y: Math.floor(Math.random() * 100) - 50 };
    return await renderMapMenu(player, userName, db, town.location.x, town.location.y);
  }
  if (action === 'march_menu') {
    return renderMarchMenu(player, userName, db);
  }
  if (action.startsWith('march_')) {
    return handleMarchAction(player, action, db);
  }
  if (action === 'deploy_dungeon' || action.startsWith('idle_')) {
    const { handleIdleExpeditionAction, renderIdleExpeditionMenu } = require('./idle_expedition');
    if (action.startsWith('idle_')) {
      return handleIdleExpeditionAction(db, player, action, userName);
    }
    return renderIdleExpeditionMenu(player, userName);
    saveMinigameDB(db);
    return renderTownMenu(player, userName, db, 'military');
  }

  saveMinigameDB(db);
  return renderTownMenu(player, userName, db);
}

// ============================================================
// COMBAT RESOLUTION FOR MARCHING ARMIES
// ============================================================
export function resolveArmyMarch(db: any, attacker: import('../minigame').PlayerInventory, march: import('../minigame').ArmyMarch, guild: any = null) {
  if (!attacker) return;
  const town = attacker.town;
  if (!town) return;

  const targetId = march.targetId;
  if (!targetId) return;
  const targetPlayer = db.players?.[targetId] || db[targetId];
  
  // Return the army back if target not found
  if (!targetPlayer) {
    if (town.army) {
      town.army.infantry += march.army.infantry;
      town.army.archers += march.army.archers;
      town.army.cavalry += march.army.cavalry;
      town.army.spearmen = (town.army.spearmen || 0) + (march.army.spearmen || 0);
      town.army.catapults = (town.army.catapults || 0) + (march.army.catapults || 0);
      town.army.mercenaries = (town.army.mercenaries || 0) + (march.army.mercenaries || 0);
      town.army.factionUnits = (town.army.factionUnits || 0) + (march.army.factionUnits || 0);
    }
    pushDashboardLog(attacker, `🚩 March Returned: Target player no longer exists.`);
    return;
  }

  // Calculate Attacker Power
  let myInfantryPower = (march.army.infantry || 0) * 10;
  if (town.research?.unlockedTechs?.includes('heavyInfantry')) myInfantryPower = Math.floor(myInfantryPower * 1.1);
  myInfantryPower = Math.floor(myInfantryPower * (1 + getGeneralBuff(attacker, 'infantry_atk')));

  let myCavalryPower = (march.army.cavalry || 0) * 30;
  myCavalryPower = Math.floor(myCavalryPower * (1 + getGeneralBuff(attacker, 'cavalry_atk')));

  const { getTileType } = require('./map');
  const targetTileType = getTileType(march.targetX, march.targetY);

  let myFactionPower = (march.army.factionUnits || 0) * 20; // base power
  if (attacker.faction === 'Wu' && targetTileType === 'water') {
    myFactionPower *= 3.0; // Marines get massive 3x bonus on water tiles! (Naval Warfare)
  }

  const myPower = myInfantryPower + ((march.army.archers || 0) * 15) + myCavalryPower + ((march.army.spearmen || 0) * 12) + ((march.army.mercenaries || 0) * 20) + myFactionPower;
  let siegeBonus = 1.0;
  if ((march.army.catapults || 0) > 0) siegeBonus = 1.5; 
  if ((march.army.mercenaries || 0) > 0) siegeBonus += 0.5; // Nanman elephant siege bonus
  const totalAttackPower = myPower * siegeBonus;

  // Calculate Defender Power
  const targetTown = targetPlayer.town || { army: { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 } };
  let targetInfantryPower = (targetTown.army?.infantry || 0) * 10;
  if (targetPlayer.town?.research?.unlockedTechs?.includes('heavyInfantry')) targetInfantryPower = Math.floor(targetInfantryPower * 1.1);
  
  let targetPower = targetInfantryPower + ((targetTown.army?.archers || 0) * 15) + ((targetTown.army?.cavalry || 0) * 30) + ((targetTown.army?.spearmen || 0) * 12) + 50; 
  
  // Defender Faction Bonus (Wu gets 50% defense)
  if (targetPlayer.faction === 'Wu') targetPower *= 1.5;

  const isWin = totalAttackPower > targetPower || Math.random() < 0.25;
  const targetName = targetPlayer.discordName || targetId;
  const userName = attacker.discordName || 'Unknown';

  if (isWin) {
    // Plunder up to 50% of Coin (since it takes time to travel now, rewards should be higher than 10)
    const plunder = Math.max(10, Math.floor((targetPlayer.coins || 0) * 0.5));
    targetPlayer.coins = Math.max(0, (targetPlayer.coins || 0) - plunder);
    attacker.coins += plunder;

    pushDashboardLog(attacker, `🏹 Siege Victory! Your marching army breached the walls of ${targetName} and plundered ${plunder} Coin!`);
    pushDashboardLog(targetPlayer, `💥 DISASTROUS DEFEAT! ${userName}'s marching army breached your walls and stole ${plunder} Coin!`);
    
    if (targetPlayer.isBot && targetPlayer.town) {
      targetPlayer.town.traumaCount = (targetPlayer.town.traumaCount || 0) + 1;
    }

    if (guild) {
      const { announceSiege } = require('./alerts');
      announceSiege(guild, userName, targetName, true, `Breached city walls after a long march and plundered ${plunder} Coin`).catch(() => {});
    }
  } else {
    // Loss: Casualties
    if (march.army.infantry > 0) march.army.infantry = Math.floor(march.army.infantry * 0.5); // 50% casualty
    pushDashboardLog(attacker, `❌ Siege Defeat: Your marching army was repelled by ${targetName}. Suffered 50% infantry casualties.`);
    pushDashboardLog(targetPlayer, `${EMOJIS.btn_shield} DEFENSE SUCCESS! Your garrison successfully repelled an attack by ${userName}!`);

    if (guild) {
      const { announceSiege } = require('./alerts');
      announceSiege(guild, userName, targetName, false, `Offensive march repelled by city guards`).catch(() => {});
    }
  }

  // Return surviving troops back to town
  if (town.army) {
    town.army.infantry += march.army.infantry;
    town.army.archers += march.army.archers;
    town.army.cavalry += march.army.cavalry;
    town.army.spearmen = (town.army.spearmen || 0) + (march.army.spearmen || 0);
    town.army.catapults = (town.army.catapults || 0) + (march.army.catapults || 0);
    town.army.mercenaries = (town.army.mercenaries || 0) + (march.army.mercenaries || 0);
    town.army.factionUnits = (town.army.factionUnits || 0) + (march.army.factionUnits || 0);
  }
}
