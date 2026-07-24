import { EMOJIS } from './emojis';
import { PlayerInventory, saveMinigameDB, getPlayer } from '../minigame';
import { handleTownAction, getLandPrice, BUILDING_COSTS, VILLAGER_COST_WLS, TIER_UPGRADES, usedSlots } from './town';
import { pushDashboardLog } from './dashboard';
import { getCurrentSeason, Season } from './season';
import { loadWorldDB, saveWorldDB } from './world';

interface AIDecision {
  priority: number;
  action: string;
  townAction: string;
  description: string;
}

export function pushGlobalRumor(db: any, rumor: string) {
  if (!db['SERVER_GLOBAL']) db['SERVER_GLOBAL'] = { rumors: [], factionTechs: {} };
  if (!db['SERVER_GLOBAL'].rumors) db['SERVER_GLOBAL'].rumors = [];
  db['SERVER_GLOBAL'].rumors.push(`[Rumor]: ${rumor}`);
  if (db['SERVER_GLOBAL'].rumors.length > 5) {
    db['SERVER_GLOBAL'].rumors.shift();
  }
}

export function evaluateStrategies(db: any, player: any, botName: string, isHumanAuto: boolean): AIDecision[] {
  const town = player.town;
  if (!town) return [];

  const decisions: AIDecision[] = [];
  const used = usedSlots(town);
  const totalSlots = town.landSlots;
  const freeSlots = totalSlots - used;
  const coins = player.coins || 0;
  const m = player.materials || {};
  const iron = m['Iron'] || 0;
  const copper = m['Copper'] || 0;
  const wood = m['Wood'] || 0;
  const personality = player.personality || 'BALANCED'; // WARLORD, MERCHANT, SCHOLAR, GAMBLER, BALANCED

  const season = getCurrentSeason();

  // --- AI LOGIC: 5 LAYERS OF ADAPTIVE HEURISTIC ---

  // L0: Disaster Response (Halt Spending if active disaster)
  const isDisaster = !!town.activeDisaster;

  // Expected Cashflow Heuristic
  const expectedPassiveCoins = ((town.buildings?.marketplaces || 0)*6) + ((town.buildings?.inns || 0)*8) + ((town.buildings?.harbours || 0)*15);
  const expectedTaxes = (town.landSlots || 1) * 0.5 + Math.floor((town.villagers || 0) / 10);
  const isCashflowBad = expectedPassiveCoins <= expectedTaxes;

  // --- AI BAILOUT SYSTEM ---
  if (isCashflowBad && personality === 'WARLORD' && coins < 10 && (town.publicOrder || 100) < 50) {
    player.coins = (player.coins || 0) + 200;
    if (!town.food) town.food = { rice: 0, meat: 0, milk: 0, egg: 0, wool: 0 };
    town.food.rice += 100;
    pushDashboardLog(player, `👑 Faksi ${player.faction} mengirimkan bantuan darurat 200 Koin dan 100 Beras!`);
    pushGlobalRumor(db, `Faksi ${player.faction} mengirimkan bantuan logistik darurat kepada Jenderal ${botName} yang nyaris bangkrut!`);
  }

  // L1: SOCIAL & ORDER LAYER (Poverty & Public Order Calibration)
  const workplaceSlots = 
    ((town.buildings?.farms || 0) * 2) + 
    ((town.buildings?.lumberMills || 0) * 2) + 
    ((town.buildings?.quarries || 0) * 2) + 
    ((town.buildings?.smithies || 0) * 2) + 
    ((town.buildings?.stables || 0) * 2) + 
    ((town.buildings?.marketplaces || 0) * 5 * (town.buildingLevels?.marketplace || 1)) +
    ((town.buildings?.harbours || 0) * 4) +
    ((town.buildings?.inns || 0) * 3) +
    ((town.buildings?.schools || 0) * 2);

  const povertyRate = Math.max(0, town.villagers - workplaceSlots);
  
  if ((town.publicOrder || 0) < 50) {
    // Rebel suppression
    const totalArmy = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.cavalry || 0) + (town.army?.spearmen || 0);
    if (totalArmy >= 50) {
      decisions.push({ priority: 350, action: 'rebel_fight', townAction: 'rebel_fight', description: `Ã°Å¸Å¡Â¨ **${botName}** mengirim pasukan untuk menumpas pemberontak!` });
    }
  }
   // --- BALANCED COMMERCIAL INFRASTRUCTURE ---
  if (freeSlots >= 1 && !isDisaster && !(town.buildings.marketplaces || 0)) {
    if (coins >= BUILDING_COSTS.marketplace.coins) {
      decisions.push({ priority: 280, action: 'build_marketplace', townAction: 'build_marketplace', description: `Ã°Å¸Â Âª **${botName}** membangun Pasar Kota untuk perdagangan dan pajak.` });
    }
  }

  // --- BALANCED CITY INFRASTRUCTURE & POPULATION FOCUS ---
  const maxHousing = (town.buildings.houses || 1) * 10;
  const currentFarms = town.buildings.farms || 0;
  const currentLumberMills = town.buildings.lumberMills || 0;
  const currentQuarries = town.buildings.quarries || 0;
  const maxIndustryCap = Math.max(3, (town.tier || 1) * 3); // Cap lumber mills & quarries to Tier * 3

  // 1. POPULATION CAP & HOUSING FOCUS (Priority: 270)
  if (freeSlots >= 1 && !isDisaster && town.villagers >= maxHousing - 2) {
    if (coins >= BUILDING_COSTS.house.coins) {
      decisions.push({ priority: 270, action: 'build_house', townAction: 'build_house', description: `Ã°Å¸ÂÂ  **${botName}** membangun Rumah Baru untuk menampung warga.` });
    }
  }

  // 2. FARM & FOOD SECURITY FOCUS (Priority: 260)
  if (freeSlots >= 1 && !isDisaster && currentFarms < (town.tier || 1) * 2) {
    if (coins >= BUILDING_COSTS.farm.coins && season !== Season.WINTER) {
      decisions.push({ priority: 260, action: 'build_farm', townAction: 'build_farm', description: `${EMOJIS.res_grain} **${botName}** membangun Ladang Pangan.` });
    }
  }

  // 3. RECRUIT PEASANT WORKERS (Priority: 250)
  if (town.villagers < maxHousing && coins >= VILLAGER_COST_WLS) {
    decisions.push({ priority: 250, action: 'recruit_peasant', townAction: 'recruit_peasant', description: `Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸Å’Â¾ **${botName}** merekrut warga baru untuk kotanya.` });
  }

  // 4. BALANCED INDUSTRY (Capped to Tier * 3)
  let warMult = personality === 'WARLORD' ? 1.2 : 1.0;
  if (freeSlots >= 1 && !isDisaster) {
    if (currentLumberMills < maxIndustryCap && currentLumberMills <= currentQuarries && coins >= BUILDING_COSTS.lumberMill.coins) {
      decisions.push({ priority: 150 * warMult, action: 'build_lumberMill', townAction: 'build_lumberMill', description: `${EMOJIS.res_wood} **${botName}** membangun Lumber Mill.` });
    } else if (currentQuarries < maxIndustryCap && currentQuarries < currentLumberMills && coins >= BUILDING_COSTS.quarry.coins) {
      decisions.push({ priority: 150 * warMult, action: 'build_quarry', townAction: 'build_quarry', description: `${EMOJIS.res_iron} **${botName}** mendirikan Quarry.` });
    }
    if (town.tier >= 3 && !(town.buildings.smithies || 0) && coins >= BUILDING_COSTS.smithy.coins) {
      decisions.push({ priority: 165 * warMult, action: 'build_smithy', townAction: 'build_smithy', description: `Ã¢Å¡â€™Ã¯Â¸Â **${botName}** membangun Pande Besi.` });
    }
    if (town.tier >= 2 && !(town.buildings.hospitals || 0) && coins >= BUILDING_COSTS.hospital.coins) {
      decisions.push({ priority: 180, action: 'build_hospital', townAction: 'build_hospital', description: `🏥 **${botName}** mendirikan Rumah Sakit untuk pasukannya.` });
    }
    if (town.tier >= 3 && !(town.buildings.stables || 0) && coins >= BUILDING_COSTS.stable.coins) {
      decisions.push({ priority: 170 * warMult, action: 'build_stable', townAction: 'build_stable', description: `🐎 **${botName}** membangun Kandang Kuda Kavaleri.` });
    }
    if (town.tier >= 3 && !(town.buildings.workshops || 0) && coins >= BUILDING_COSTS.workshop.coins) {
      decisions.push({ priority: 175 * warMult, action: 'build_workshop', townAction: 'build_workshop', description: `🛠️ **${botName}** membangun Workshop Senjata Pengepungan.` });
    }
  }

  // 5. LIVESTOCK & RANCH STRATEGY (Priority: 380 / 375)
  if (town.tier >= 2) {
    const currentRanches = town.buildings.ranches || 0;
    if (freeSlots >= 1 && !isDisaster && currentRanches < Math.max(1, Math.floor(town.tier / 2)) && coins >= BUILDING_COSTS.ranch.coins) {
      decisions.push({ priority: 380, action: 'build_ranch', townAction: 'build_ranch', description: `🐄 **${botName}** mendirikan Peternakan (Ranch) baru.` });
    }

    if (currentRanches >= 1) {
      if (!town.animals) town.animals = { chickens: 0, goats: 0, cows: 0 };
      const currentAnimals = (town.animals.chickens || 0) + (town.animals.goats || 0) + (town.animals.cows || 0);
      const maxCap = currentRanches * 4;

      if (currentAnimals < maxCap) {
        if ((town.animals.cows || 0) < 2 && coins >= 4) {
          decisions.push({ priority: 375, action: 'buy_animal_cow', townAction: 'buy_animal_cow', description: `🐄 **${botName}** membeli 1 Sapi untuk Peternakan!` });
        } else if ((town.animals.chickens || 0) < 2 && coins >= 1) {
          decisions.push({ priority: 372, action: 'buy_animal_chicken', townAction: 'buy_animal_chicken', description: `🐔 **${botName}** membeli 1 Ayam untuk Peternakan!` });
        } else if ((town.animals.goats || 0) < 2 && coins >= 1) {
          decisions.push({ priority: 370, action: 'buy_animal_goat', townAction: 'buy_animal_goat', description: `🐐 **${botName}** membeli 1 Kambing untuk Peternakan!` });
        } else if (coins >= 4 && currentAnimals < maxCap) {
          decisions.push({ priority: 365, action: 'buy_animal_cow', townAction: 'buy_animal_cow', description: `🐄 **${botName}** menambah Sapi untuk Peternakan!` });
        }
      }
    }
  }

  // L2: HUNGER & SMART MARKET TRADING LAYER
  const totalFood = (town.food?.rice || 0) + (town.food?.meat || 0);
  if (totalFood < town.villagers * 2 && coins > 10) {
    decisions.push({ priority: 320, action: 'market_buy_food', townAction: 'market_buy_food', description: `Ã°Å¸Ââ€“ **${botName}** membeli makanan darurat di pasar.` });
  } else if (season === Season.AUTUMN && totalFood < town.villagers * 10 && coins > 20) {
    decisions.push({ priority: 300, action: 'market_buy_food', townAction: 'market_buy_food', description: `Ã°Å¸Å’Â¾ **${botName}** memborong beras untuk persiapan musim dingin!` });
  }

  // SMART MATERIAL BALANCING & LIQUIDITY TRADING
  if (coins < 100 && (wood > 80 || iron > 80)) {
    if (wood > 80) decisions.push({ priority: 230, action: 'market_sell_wood', townAction: 'market_sell_wood', description: `Ã°Å¸ÂªÂµ **${botName}** menjual surplus Kayu di pasar untuk likuiditas koin.` });
    else if (iron > 80) decisions.push({ priority: 230, action: 'market_sell_iron', townAction: 'market_sell_iron', description: `Ã¢â€ºÂÃ¯Â¸Â **${botName}** menjual surplus Besi di pasar untuk likuiditas koin.` });
  }

  // Tier Upgrade Focus & High Priority Expansion
  const nextTier = town.tier + 1;
  if (nextTier <= 6 && TIER_UPGRADES[nextTier]) {
    const req = TIER_UPGRADES[nextTier];
    if (town.landSlots >= req.requiredLand && town.villagers >= req.requiredVillagers && coins >= req.wlsRequired) {
      decisions.push({ priority: 295, action: 'upgrade_tier', townAction: 'upgrade', description: `Ã°Å¸ÂÂ° **${botName}** naik ke **Tier ${nextTier}**!` });
    } else {
      if ((freeSlots === 0 || town.landSlots < req.requiredLand) && coins >= getLandPrice(player)) {
        decisions.push({ priority: 285, action: 'buy_land', townAction: 'buyland', description: `Ã°Å¸â€”ÂºÃ¯Â¸Â **${botName}** membeli lahan ekspansi kota!` });
      }
    }
  }

  // L4: MILITARY & FORGING LAYER (Smart Drafting)
  if (town.tier >= 2 || (town.buildings.smithies || 0) > 0) {
    if (iron >= 10 && wood >= 5) decisions.push({ priority: 155 * warMult, action: 'forge_sword', townAction: 'forge_sword', description: `Ã¢Å¡â€™Ã¯Â¸Â **${botName}** menempa Sword!` });
    if (wood >= 10 && copper >= 5) decisions.push({ priority: 154 * warMult, action: 'forge_bow', townAction: 'forge_bow', description: `Ã°Å¸ÂÂ¹ **${botName}** menempa Bow!` });
    if (wood >= 10 && iron >= 10) decisions.push({ priority: 153 * warMult, action: 'forge_spear', townAction: 'forge_spear', description: `Ã°Å¸â€”Â¡Ã¯Â¸Â **${botName}** menempa Spear!` });
    if (iron >= 15 && wood >= 5) decisions.push({ priority: 152 * warMult, action: 'forge_armor', townAction: 'forge_armor', description: `${EMOJIS.btn_shield} **${botName}** menempa Armor!` });
  }

  if ((town.buildings.workshops || 0) > 0 && coins >= 10 && iron >= 20 && wood >= 10) {
     decisions.push({ priority: 165 * warMult, action: 'craft_catapult', townAction: 'craft_catapult', description: `Ã¢Ëœâ€žÃ¯Â¸Â **${botName}** merakit Mesin Catapult Pengepungan!` });
  }

  // Multi-Group Expedition & Espionage Evaluation
  const totalTroops = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.cavalry || 0) + (town.army?.spearmen || 0) + (town.army?.catapults || 0);
  const spyCount = town.covertOps?.spies || 0;
  const { activeWorldBoss } = require('./world-boss');
  
  if (totalTroops > 20 && spyCount === 0 && coins >= 10) {
    decisions.push({ priority: 220, action: 'recruit_covert_spy', townAction: 'recruit_covert_spy', description: `Ã°Å¸â€¢ÂµÃ¯Â¸Â **${botName}** menyewa Mata-mata untuk pengintaian taktis!` });
  }

  if (totalTroops > 30) {
    const estimatedPower = (town.army?.infantry || 0) * 10 + (town.army?.archers || 0) * 12 + (town.army?.cavalry || 0) * 18 + (town.army?.spearmen || 0) * 14 + (town.army?.catapults || 0) * 35;

    if (activeWorldBoss && activeWorldBoss.isActive && activeWorldBoss.hp > 0) {
      const winProbability = Math.min(1.0, estimatedPower / 500);
      if (winProbability >= 0.5 && Math.random() < (0.4 * warMult)) {
        decisions.push({ priority: 300 * warMult, action: 'deploy_world_boss', townAction: 'deploy_boss', description: `Ã¢Å¡â€Ã¯Â¸Â **${botName}** (Peluang Menang: ${Math.floor(winProbability * 100)}%) memimpin ekspedisi ke **World Boss**!` });
      } else if (winProbability < 0.5 && spyCount > 0) {
        decisions.push({ priority: 210, action: 'train_infantry', townAction: 'train_infantry', description: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â **${botName}** (Hasil Spionase: Win-rate <50%) menunda serangan & melatih pertahanan!` });
      }
    } else {
      const winProbability = Math.min(1.0, estimatedPower / 300);
      if (winProbability >= 0.5 && Math.random() < (0.3 * warMult)) {
        decisions.push({ priority: 180 * warMult, action: 'deploy_dungeon', townAction: 'deploy_dungeon', description: `Ã°Å¸ÂÂ° **${botName}** (Taktik Terencana) mengirim Ekspedisi ke **Dungeon**!` });
      }
    }
  }

  const w = town.weapons || { sword: 0, bow: 0, spear: 0, armor: 0 };
  const infantry = town.army?.infantry || 0;
  const archers = town.army?.archers || 0;
  
  // Tactical Counter-Troop Intelligence
  let counterMultArcher = 1.0;
  let counterMultCavalry = 1.0;
  let counterMultInfantry = 1.0;

  if (activeWorldBoss?.isActive) {
    counterMultArcher = 2.5; // Archers counter Infantry boss
    counterMultCavalry = 2.0; // Cavalry counters Archer waves
  }

  // Smart Balance & Counter Troops
  if (town.villagers >= 1) {
    if ((town.horses || 0) >= 1 && w.bow >= 1 && (w.sword >= 1 || w.spear >= 1)) {
      decisions.push({ priority: 145 * warMult * counterMultCavalry, action: 'train_cavalry', townAction: 'train_cavalry', description: `Ã°Å¸ÂÅ½ **${botName}** melatih Pasukan Kavaleri Elit!` });
    } else if (w.bow >= 1 && w.armor >= 1 && archers <= infantry) {
      decisions.push({ priority: 140 * warMult * counterMultArcher, action: 'train_archer', townAction: 'train_archer', description: `Ã°Å¸ÂÂ¹ **${botName}** melatih Archer Pemanah Taktis!` });
    } else if (w.sword >= 1 && w.armor >= 1) {
      decisions.push({ priority: 130 * warMult * counterMultInfantry, action: 'train_infantry', townAction: 'train_infantry', description: `${EMOJIS.unit_infantry} **${botName}** melatih Infantri!` });
    }
  }

  if (infantry >= 50 && !player.activeDungeonBattle) {
     let dungeonPriority = 180 * warMult;
     if (season === Season.WINTER) dungeonPriority += 50; // Winter instinct: fight more since farms are dead
     decisions.push({ priority: dungeonPriority, action: 'dungeon_grind', townAction: 'attack', description: `${EMOJIS.unit_infantry} **${botName}** merampok Dungeon!` });
  }

  // L5: CARAVAN TRADING LAYER
  if (personality === 'MERCHANT' && coins > 200 && (wood > 100 || iron > 100) && !isDisaster) {
    decisions.push({ priority: 185, action: 'caravan_trade', townAction: 'caravan_trade', description: `Ã°Å¸Å¡â€š **${botName}** mengirim Konvoi Dagang ke ibukota!` });
  }

  // Tech-Rusher (Scholar trait boosts priority)
  let techMult = personality === 'SCHOLAR' ? 3.0 : 1.0;
  if (town.tier >= 3 && freeSlots >= 1 && !(town.buildings.academies || 0) && coins >= BUILDING_COSTS.academy.coins && !isCashflowBad) {
    decisions.push({ priority: 150 * techMult, action: 'build_academy', townAction: 'build_academy', description: `Ã°Å¸Å½â€œ **${botName}** mendirikan Akademi.` });
  }
  if ((town.buildings.academies || 0) > 0 && !town.research?.activeId) {
    if (!town.research?.unlockedTechs?.includes('advancedFarming') && coins >= 15) decisions.push({ priority: 145 * techMult, action: 'research_farm', townAction: 'research_advancedFarming', description: `Ã°Å¸â€Â¬ **${botName}** riset Advanced Farming!` });
    
    // TECH PARADIGM: Gunpowder discovery
    if (personality === 'SCHOLAR' && coins >= 200 && town.research?.unlockedTechs?.includes('metallurgy') && !town.research?.unlockedTechs?.includes('gunpowder')) {
       decisions.push({ priority: 195 * techMult, action: 'research_gunpowder', townAction: 'research_gunpowder', description: `Ã°Å¸â€™Â¥ **${botName}** jenius Scholar! Memulai riset rahasia Gunpowder!` });
    }
  }

  // Gambler (Gacha Addict)
  const { getGachaCost, GENERALS_DB } = require('./generals');
  let gachaMult = personality === 'GAMBLER' ? 5.0 : 1.0;
  const gCost = getGachaCost(town.generals?.length || 0);
  if (town.tier >= 4 && coins >= gCost && (town.generals?.length || 0) < 3) {
    decisions.push({ priority: 135 * gachaMult, action: 'gacha_general', townAction: 'gacha_general', description: `Ã°Å¸Å½Â´ **${botName}** Gacha Jenderal!` });
  }

  // Court Officer Recruitment
  const { THREE_KINGDOMS_ROSTER } = require('./characters');
  const ownedCharIds = (player.characters || []).map((c: any) => c.id);
  const hireableChars = THREE_KINGDOMS_ROSTER.filter((c: any) => (c.affinity === player.faction || c.affinity === 'Neutral') && !ownedCharIds.includes(c.id));
  if (hireableChars.length > 0 && coins >= 120) {
    const targetChar = hireableChars[0];
    if (coins >= targetChar.price) {
      decisions.push({ priority: 175, action: `recruit_char_${targetChar.id}`, townAction: `recruit_char_${targetChar.id}`, description: `Ã°Å¸â€œÅ“ **${botName}** merekrut **${targetChar.name}** ke Kabinet Istana!` });
    }
  }

  // AUTO EQUIP GENERAL (Role-Balanced Party: Tank / DPS / Healer)
  const activeParty = town.activeParty || [];
  const unequipped = (town.generals || []).filter((gId: string) => !activeParty.includes(gId));
  if (unequipped.length > 0 && activeParty.length < 3) {
    const genId = unequipped[0];
    const genObj = GENERALS_DB.find((x: any) => x.id === genId);
    const genName = genObj ? genObj.name : genId;
    decisions.push({ priority: 350, action: `equip_general_${genId}`, townAction: `equip_general_${genId}`, description: `🎖️ **${botName}** menugaskan Jenderal **${genName}** ke Pasukan Utama!` });
  }

  for (const d of decisions) d.priority += Math.floor(Math.random() * 21) - 10;
  decisions.sort((a, b) => b.priority - a.priority);
  return decisions;
}

export async function runBotFullAI(db: any, botUserId: string, botName: string, isHumanAuto: boolean = false): Promise<string[]> {
  const player = getPlayer(db, botUserId);
  const actions: string[] = [];

  if (!player.materials) player.materials = {};
  if (!player.faction) {
    const roll = Math.random();
    player.faction = roll < 0.33 ? 'Shu' : (roll < 0.66 ? 'Wei' : 'Wu');
    actions.push(`Ã°Å¸Å¡Â© **${botName}** telah bersumpah setia kepada faksi **${player.faction}**!`);
  }

  if (!player.personality) {
    const pRoll = Math.random();
    if (pRoll < 0.25) player.personality = 'WARLORD';
    else if (pRoll < 0.50) player.personality = 'MERCHANT';
    else if (pRoll < 0.75) player.personality = 'SCHOLAR';
    else player.personality = 'GAMBLER';
  }

  if (!isHumanAuto && !player.town) {
    (player as any).isBot = true;
    player.town = {
      tier: 1,
      landSlots: 5,
      villagers: 2,
      morale: 100,
      publicOrder: 100,
      food: { rice: 100, milk: 0, meat: 50, egg: 0, wool: 0 },
      animals: { chickens: 0, goats: 0, cows: 0 },
      lastAnimalIncome: Date.now(),
      buildings: { houses: 1, farms: 1, orchards: 0, ranches: 0, smithies: 0, marketplaces: 1 },
      generals: [],
      weapons: { sword: 0, bow: 0, spear: 0, armor: 0 },
      army: { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 }
    };
    player.coins = (player.coins || 0) + 500;
    actions.push(`Ã°Å¸ÂÂ° **${botName}** baru saja mendirikan kotanya di dunia Three Kingdoms!`);
  }

  // TRAUMA-BASED LEARNING (MUTATION)
  if (player.town && (player.town.traumaCount || 0) >= 3 && player.personality === 'MERCHANT') {
    player.personality = 'WARLORD';
    player.town.traumaCount = 0; // Reset
    const rumor = `${botName} dulunya adalah pedagang damai, namun karena sering dirampok, ia telah kehilangan akal sehat dan kini mendeklarasikan dirinya sebagai Warlord yang haus darah!`;
    actions.push(`Ã°Å¸â€™â‚¬ **TRAUMA EVOLUTION**: ${rumor}`);
    pushGlobalRumor(db, rumor);
  }

  // Trigger passive income collection so bots don't go bankrupt permanently
  if (player.town) {
    const { collectAnimalIncome } = require('./town');
    collectAnimalIncome(db, player);

    // ONE-TIME FIX: Unstick the bots!
    if ((player.town.landSlots || 0) < 5) {
      player.town.landSlots = 5;
      player.coins += 500;
    }
  }

  player.lastActiveTime = Date.now();
  const strategies = evaluateStrategies(db, player, botName, isHumanAuto);
  let executed = 0;

  for (const decision of strategies) {
    if (executed >= 3) break; 
    try {
      const { handleTownAction } = require('./town');
      const { handleResearchAction } = require('./research');
      const { handleGeneralAction } = require('./generals');
      const { handleMarketAction } = require('./market');
      const { handleDungeonAction } = require('./dungeon_v2');
      
      let successStr: any = null;
      let lastLogBefore = player.dashboardLog && player.dashboardLog.length > 0 ? player.dashboardLog[player.dashboardLog.length - 1] : '';
      
      if (decision.action === 'market_buy_food') {
         if ((player.coins || 0) >= 10) {
            player.coins -= 10;
            if (!player.town!.food) player.town!.food = { rice: 0, milk: 0, meat: 0, egg: 0, wool: 0 };
            player.town!.food.rice += 50;
            successStr = "Bought food darurat";
         }
      } else if (decision.action.startsWith('market_sell_')) {
         const material = decision.action.replace('market_sell_', '');
         if (material === 'wood' && (player.materials['Wood'] || 0) >= 30) {
           player.materials['Wood'] -= 30;
           player.coins = (player.coins || 0) + 1;
           successStr = "Sold wood";
         } else if (material === 'iron' && (player.materials['Iron'] || 0) >= 20) {
           player.materials['Iron'] -= 20;
           player.coins = (player.coins || 0) + 1;
           successStr = "Sold iron";
         }
      } else if (decision.action.startsWith('forge_')) {
         if (!player.town!.weapons) player.town!.weapons = { sword: 0, bow: 0, spear: 0, armor: 0 };
         if (decision.action === 'forge_sword' && (player.materials['Iron'] || 0) >= 10 && (player.materials['Wood'] || 0) >= 5) {
            player.materials['Iron'] -= 10; player.materials['Wood'] -= 5;
            player.town!.weapons.sword = (player.town!.weapons.sword || 0) + 1;
            successStr = "Forged sword";
         } else if (decision.action === 'forge_bow' && (player.materials['Wood'] || 0) >= 10 && (player.materials['Copper'] || 0) >= 5) {
            player.materials['Wood'] -= 10; player.materials['Copper'] -= 5;
            player.town!.weapons.bow = (player.town!.weapons.bow || 0) + 1;
            successStr = "Forged bow";
         } else if (decision.action === 'forge_spear' && (player.materials['Wood'] || 0) >= 10 && (player.materials['Iron'] || 0) >= 10) {
            player.materials['Wood'] -= 10; player.materials['Iron'] -= 10;
            player.town!.weapons.spear = (player.town!.weapons.spear || 0) + 1;
            successStr = "Forged spear";
         } else if (decision.action === 'forge_armor' && (player.materials['Iron'] || 0) >= 15 && (player.materials['Wood'] || 0) >= 5) {
            player.materials['Iron'] -= 15; player.materials['Wood'] -= 5;
            player.town!.weapons.armor = (player.town!.weapons.armor || 0) + 1;
            successStr = "Forged armor";
         }
      } else if (decision.action.startsWith('research_')) successStr = await handleResearchAction(player, decision.townAction, db);
      else if (decision.action.startsWith('gacha_') || decision.action.startsWith('equip_') || decision.action.startsWith('recruit_char_')) successStr = await handleGeneralAction(player, decision.townAction, db);
        else if (decision.action.startsWith('dungeon_')) {
          const { handleDungeonCampaign } = require('./dungeon_v2');
          handleDungeonCampaign(db, player, [decision.townAction], botUserId, null);
          successStr = "Dungeon grinding started";
        }
      else if (decision.action.startsWith('deploy_')) {
        const { handleDeployArmySubmit } = require('./deployments');
        const targetType = decision.action === 'deploy_world_boss' ? 'WORLD_BOSS' : 'DUNGEON';
        const troops = {
          infantry: Math.floor((player.town!.army?.infantry || 0) * 0.4),
          archers: Math.floor((player.town!.army?.archers || 0) * 0.4),
          cavalry: Math.floor((player.town!.army?.cavalry || 0) * 0.4),
          spearmen: Math.floor((player.town!.army?.spearmen || 0) * 0.4),
          catapults: Math.floor((player.town!.army?.catapults || 0) * 0.4)
        };
        handleDeployArmySubmit(db, botUserId, targetType, troops);
        successStr = "Deployed army successfully";

        // MULTI-AI WORLD BOSS RAID CALL
        if (targetType === 'WORLD_BOSS' && player.faction) {
          const ralliedNames: string[] = [];
          const allUserIds = Object.keys(db);
          for (const allyId of allUserIds) {
            if (allyId === botUserId) continue;
            const ally = db[allyId];
            if (ally && ally.faction === player.faction && ally.town && ally.town.army) {
              const allyInf = ally.town.army.infantry || 0;
              const allyArc = ally.town.army.archers || 0;
              const allyCav = ally.town.army.cavalry || 0;
              const allyTotal = allyInf + allyArc + allyCav;
              if (allyTotal >= 5) {
                const allyTroops = {
                  infantry: Math.floor(allyInf * 0.4),
                  archers: Math.floor(allyArc * 0.4),
                  cavalry: Math.floor(allyCav * 0.4),
                  spearmen: Math.floor((ally.town.army.spearmen || 0) * 0.4),
                  catapults: Math.floor((ally.town.army.catapults || 0) * 0.4)
                };
                handleDeployArmySubmit(db, allyId, 'WORLD_BOSS', allyTroops);
                const allyName = ally.discordName || `Jenderal_${allyId.slice(0, 4)}`;
                ralliedNames.push(allyName);
                pushDashboardLog(ally, `Ã°Å¸â€Â¥ [Raid Rally] Joining World Boss attack called by ${botName}!`);
              }
            }
          }

          const rumor = `Ã°Å¸â€Â¥ [RAID CALL FAKSI ${player.faction.toUpperCase()}] Jenderal ${botName} membunyikan Trompet Perang! ${ralliedNames.length > 0 ? `Sekutu (${ralliedNames.join(', ')}) serentak membantai World Boss!` : 'Memimpin serbuan ke World Boss!'}`;
          pushGlobalRumor(db, rumor);
        }
      }
      else successStr = await handleTownAction(db, player, decision.townAction, botName);
      
      let isSuccess = false;
      let lastLogAfter = player.dashboardLog && player.dashboardLog.length > 0 ? player.dashboardLog[player.dashboardLog.length - 1] : '';
      
      if (typeof successStr === 'object' && successStr !== null) {
        isSuccess = true;
      } else if (typeof successStr === 'string' && !successStr.includes('❌') && !successStr.includes('Tidak cukup')) {
        isSuccess = true;
      } else if (lastLogAfter !== lastLogBefore) {
        if (!lastLogAfter.includes('fail') && !lastLogAfter.includes('Failed') && !lastLogAfter.includes('Ã¢Â Å’') && !lastLogAfter.includes('Tidak cukup')) {
          isSuccess = true;
        }
      }

      if (isSuccess) {
        if (decision.description) actions.push(decision.description);
        
        // Push Tech paradigm shift rumor
        if (decision.action === 'research_gunpowder') {
          const rumor = `${botName}, seorang sarjana jenius, baru saja memulai eksperimen dengan bubuk hitam yang meledak...`;
          pushGlobalRumor(db, rumor);
        }

        pushDashboardLog(player, `[AI-${player.personality}] ${decision.action}`);
        executed++;
      }
    } catch (err) { continue; }
  }

  // SWARM INTELLIGENCE: Same-Faction Emergency Logistics & Trade (Only System Bots donate)
  if (player.faction && !isHumanAuto) {
    const allUsers = Object.keys(db);
    for (const otherId of allUsers) {
      if (otherId === botUserId) continue;
      const other = db[otherId];
      if (other && other.faction === player.faction && other.town) {
        if ((player.coins || 0) >= 300 && (other.coins || 0) < 50) {
          player.coins -= 100;
          other.coins = (other.coins || 0) + 100;
          const otherName = other.discordName || `Jenderal_${otherId.slice(0, 4)}`;
          const rumor = `Faksi ${player.faction}: Jenderal ${botName} mengirimkan dana bantuan 100 Coin kepada ${otherName}!`;
          actions.push(`ðŸ¤ **${botName}** mengirimkan dana bantuan 100 Coin ke **${otherName}** (${player.faction})!`);
          actions.push(`ðŸ¤  **${botName}** mengirimkan dana bantuan 100 Coin ke **${otherName}** (${player.faction})!`);
          pushGlobalRumor(db, rumor);
          break;
        } else if ((player.materials?.['Wood'] || 0) >= 150 && (other.materials?.['Wood'] || 0) < 20) {
          player.materials['Wood'] -= 50;
          if (!other.materials) other.materials = {};
          const otherName = other.discordName || `Jenderal_${otherId.slice(0, 4)}`;
          const rumor = `Faksi ${player.faction}: Jenderal ${botName} mengirimkan 50x Kayu ke ${otherName}!`;
          actions.push(`🪵 **${botName}** mengirimkan bantuan 50x Kayu ke **${otherName}** (${player.faction})!`);
          pushGlobalRumor(db, rumor);
          break;
        }
      }
    }
  }

  player.lastActiveTime = Date.now();
  return actions;
}
