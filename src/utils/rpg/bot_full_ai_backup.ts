import { PlayerInventory, saveMinigameDB, getPlayer } from '../minigame';
import { handleTownAction, getLandPrice, BUILDING_COSTS, VILLAGER_COST_WLS, TIER_UPGRADES, usedSlots } from './town';
import { pushDashboardLog } from './dashboard';

// ============================================================
// FULL BOT AI SIMULATOR — Self-Learning Three Kingdoms Engine
// ============================================================
// Each bot evaluates its city state and makes multiple strategic
// decisions per tick using a priority-weighted scoring system.
// Bots "learn" by adapting their strategy based on current metrics.
// ============================================================

interface AIDecision {
  priority: number;
  action: string;
  townAction: string;
  description: string;
}

/**
 * Evaluate all possible city actions and rank them by strategic priority.
 * This is the "self-learning" engine — the bot scores decisions dynamically
 * based on its current economic and military state.
 */
function evaluateStrategies(db: any, player: PlayerInventory, botName: string, isHumanAuto: boolean): AIDecision[] {
  const town = player.town;
  if (!town) return [];

  const decisions: AIDecision[] = [];
  const used = usedSlots(town);
  const totalSlots = town.landSlots * 4;
  const freeSlots = totalSlots - used;
  const maxV = town.buildings.houses * 10;
  const coins = player.coins || 0;

  // ── OWNER AI MAX INTELLIGENCE OVERRIDE ──
  if (isHumanAuto) {
    const nextTier = town.tier + 1;
    let focusUpgrade = false;
    
    // 1. Focus Upgrade or Save Money
    if (nextTier <= 6 && TIER_UPGRADES[nextTier]) {
      const req = TIER_UPGRADES[nextTier];
      const needsLand = town.landSlots < req.requiredLand;
      const needsVillagers = town.villagers < req.requiredVillagers;
      const needsWls = coins < req.wlsRequired;
      const landPrice = getLandPrice(player);

      if (!needsLand && !needsVillagers && !needsWls) {
        decisions.push({ priority: 200, action: 'upgrade_tier', townAction: 'upgrade', description: `👑 **${botName}** memfokuskan sumber daya dan naik ke **Tier ${nextTier}**!` });
        focusUpgrade = true;
      } else {
        if (needsLand && coins >= landPrice) {
          decisions.push({ priority: 190, action: 'buy_land', townAction: 'buyland', description: `🏰 **${botName}** membeli lahan demi persiapan ekspansi Tier kota.` });
          focusUpgrade = true;
        } else if (needsVillagers) {
          if ((town.buildings.houses * 10) <= town.villagers && coins >= 10 && freeSlots >= 1) {
            decisions.push({ priority: 190, action: 'build_house', townAction: 'build_house', description: `🏘️ **${botName}** membangun rumah untuk syarat populasi Tier kota.` });
            focusUpgrade = true;
          } else if (coins >= 5) {
            decisions.push({ priority: 190, action: 'recruit_peasant', townAction: 'recruit_peasant', description: `👥 **${botName}** merekrut warga baru untuk persiapan Tier kota.` });
            focusUpgrade = true;
          }
        }
        
        if (!focusUpgrade && (needsWls || (!needsLand && !needsVillagers))) {
          decisions.push({ priority: 195, action: 'save_money', townAction: 'none', description: `💰 **${botName}** fokus menyimpan uang untuk syarat Upgrade Tier.` });
          focusUpgrade = true;
        }
      }
    }
    
    // 2. Grinding & Raid if Army > 100
    if ((town.army?.infantry || 0) >= 100 && !player.activeDungeonBattle) {
       decisions.push({ priority: 180, action: 'dungeon_grind', townAction: 'attack', description: `⚔️ **${botName}** mengerahkan 100+ tentaranya masuk ke **Dungeon** untuk grinding dan raiding harta!` });
    }
  }

  // ── SURVIVAL LAYER (Priority 100+) ──
  // If morale is critically low, fix it first
  if ((town.morale || 100) < 30) {
    decisions.push({
      priority: 120,
      action: 'morale_crisis',
      townAction: 'build_tavern',
      description: `🍺 **${botName}** mengadakan pesta rakyat di Tavern untuk memulihkan moral kota yang anjlok!`
    });
  }

  // Suppress rebels if public order very low
  if ((town.publicOrder || 100) < 30 && (town.army?.infantry || 0) > 0) {
    decisions.push({
      priority: 110,
      action: 'suppress_rebels',
      townAction: 'rebel_fight',
      description: `⚔️ **${botName}** mengerahkan pasukan infantri untuk menumpas pemberontak di dalam kota!`
    });
  }

  // ── ECONOMY LAYER (Priority 60-80) ──
  // Build farms for food production
  if (town.buildings.farms < 5 && coins >= BUILDING_COSTS.farm.coins && freeSlots >= 1) {
    decisions.push({
      priority: 80 - town.buildings.farms * 5,
      action: 'build_farm',
      townAction: 'build_farm',
      description: `🌾 **${botName}** membangun **Ladang Pertanian** baru — produksi padi meningkat!`
    });
  }

  // Build lumber mill
  if (!(town.buildings.lumberMills || 0) && coins >= BUILDING_COSTS.lumberMill.coins && freeSlots >= 1) {
    decisions.push({
      priority: 75,
      action: 'build_lumberMill',
      townAction: 'build_lumberMill',
      description: `🪵 **${botName}** mendirikan **Penggilingan Kayu** — pasokan kayu terjamin!`
    });
  }

  // Build marketplace
  if (!(town.buildings.marketplaces || 0) && coins >= BUILDING_COSTS.marketplace.coins && freeSlots >= 1) {
    decisions.push({
      priority: 72,
      action: 'build_marketplace',
      townAction: 'build_marketplace',
      description: `🏪 **${botName}** membuka **Pasar Kota** — perdagangan lokal dimulai!`
    });
  }

  // Build quarry for stone/iron
  if ((town.buildings.quarries || 0) < 2 && coins >= BUILDING_COSTS.quarry.coins && freeSlots >= 1) {
    decisions.push({
      priority: 70,
      action: 'build_quarry',
      townAction: 'build_quarry',
      description: `⛏️ **${botName}** membangun **Tambang Batu** — produksi mineral dimulai!`
    });
  }

  // ── POPULATION LAYER (Priority 50-70) ──
  // Build house if at capacity
  if (town.villagers >= maxV && coins >= BUILDING_COSTS.house.coins && freeSlots >= 1) {
    decisions.push({
      priority: 70,
      action: 'build_house',
      townAction: 'build_house',
      description: `🏠 **${botName}** membangun **Rumah Penduduk** baru — kapasitas populasi bertambah!`
    });
  }

  // Recruit peasants
  if (town.villagers < maxV && coins >= VILLAGER_COST_WLS) {
    decisions.push({
      priority: 65,
      action: 'recruit_peasant',
      townAction: 'recruit_peasant',
      description: `👥 **${botName}** merekrut **1 Rakyat Jelata** baru untuk bekerja di kota!`
    });
  }

  // ── EXPANSION LAYER (Priority 40-60) ──
  // Buy land if running out of slots
  if (freeSlots < 1) {
    const landPrice = getLandPrice(player);
    if (coins >= landPrice) {
      decisions.push({
        priority: 60,
        action: 'buy_land',
        townAction: 'buyland',
        description: `🏰 **${botName}** membeli **Lahan Baru** — wilayah kekuasaan meluas!`
      });
    }
  }

  // Upgrade city tier
  const nextTier = town.tier + 1;
  const maxAnimCap = (town.buildings.ranches || 0) * 5;
  const totalAnim = (town.animals?.chickens || 0) + (town.animals?.goats || 0) + (town.animals?.cows || 0);

  if (nextTier <= 6 && TIER_UPGRADES[nextTier]) {
    const req = TIER_UPGRADES[nextTier];
    const needsLand = town.landSlots < req.requiredLand;
    const needsVillagers = town.villagers < req.requiredVillagers;
    const needsWls = coins < req.wlsRequired;
    const landPrice = getLandPrice(player);

    if (!needsLand && !needsVillagers && !needsWls) {
      decisions.push({
        priority: 90, // High priority — tier ups are major
        action: 'upgrade_tier',
        townAction: 'upgrade',
        description: `👑 **${botName}** mengembangkan kekuasaannya — Faksi naik ke **Tier ${nextTier}**!`
      });
    } else if (totalAnim >= maxAnimCap || (town.buildings.ranches || 0) > 0) {
      // If ranches are full or at least built, heavily prioritize meeting upgrade requirements!
      if (needsLand) {
        if (coins >= landPrice) {
          decisions.push({ priority: 85, action: 'buy_land', townAction: 'buyland', description: `🏰 **${botName}** memperluas wilayah demi persiapan Upgrade Tier!` });
        } else {
          decisions.push({ priority: 84, action: 'save_money', townAction: 'none', description: `` });
        }
      } else if (needsVillagers) {
        // Needs more villagers: build houses or recruit
        if ((town.buildings.houses * 10) <= town.villagers && coins >= 10 && freeSlots >= 1) {
           decisions.push({ priority: 85, action: 'build_house', townAction: 'build_house', description: `🏘️ **${botName}** membangun **Rumah** demi menambah syarat populasi Upgrade Tier!` });
        } else if (coins >= 5) {
           decisions.push({ priority: 84, action: 'recruit_peasant', townAction: 'recruit_peasant', description: `👥 **${botName}** merekrut warga demi syarat populasi Upgrade Tier!` });
        } else {
           decisions.push({ priority: 83, action: 'save_money', townAction: 'none', description: `` });
        }
      } else if (needsWls) {
        decisions.push({ priority: 82, action: 'save_money', townAction: 'none', description: `` });
      }
    }
  }

  // ── DIPLOMACY LAYER (Priority 45-65) ──
  // Seek alliances if none exist
  if ((town.alliances?.length || 0) < 1 && coins >= 10) {
    decisions.push({
      priority: 65,
      action: 'seek_alliance',
      townAction: 'caravan_alliance',
      description: `🤝 **${botName}** mengirimkan utusan diplomatik untuk membentuk aliansi baru!`
    });
  }

  // ── MILITARY LAYER (Priority 30-50) ──
  // Build barracks if at City tier
  if (town.tier >= 3 && !(town.buildings.barracks || 0) && coins >= BUILDING_COSTS.barrack.coins && freeSlots >= 1) {
    decisions.push({
      priority: 55,
      action: 'build_barracks',
      townAction: 'build_barracks',
      description: `🏛️ **${botName}** membangun **Barak Militer** — perekrutan infantri dibuka!`
    });
  }

  // Recruit infantry
  if ((town.buildings.barracks || 0) > 0 && coins >= 5) {
    decisions.push({
      priority: 40,
      action: 'recruit_infantry',
      townAction: 'recruit_infantry',
      description: `🗡️ **${botName}** merekrut **10 Infantri** baru ke barisan pertahanan kota!`
    });
  }

  // ── RANCH LAYER (Priority 20-40) ──
  // Buy animals for passive income
  if (totalAnim < maxAnimCap) {
    if ((town.animals?.cows || 0) < 2 && coins >= 5) {
      decisions.push({ priority: 36, action: 'buy_cow', townAction: 'buy_animal_cow', description: `🐄 **${botName}** membeli **Sapi** untuk peternakan — produksi susu & daging dimulai!` });
    }
    if ((town.animals?.goats || 0) < 2 && coins >= 3) {
      decisions.push({ priority: 35, action: 'buy_goat', townAction: 'buy_animal_goat', description: `🐐 **${botName}** membeli **Kambing** untuk peternakan — hasil perahan bertambah!` });
    }
    if ((town.animals?.chickens || 0) < 4 && coins >= 2) {
      decisions.push({ priority: 34, action: 'buy_chicken', townAction: 'buy_animal_chicken', description: `🐔 **${botName}** membeli **Ayam** untuk peternakan — produksi telur meningkat!` });
    }
  }

  // Save money / Wait option (Priority 33)
  // This allows the bot to sometimes choose NOT to buy a cheap item and instead save up Coins for more expensive buildings/cows.
  if (coins < 15) {
    decisions.push({ priority: 33, action: 'save_money', townAction: 'none', description: `` });
  }

  // Build ranch if none or if full and have slots
  if (coins >= BUILDING_COSTS.ranch.coins && freeSlots >= 1) {
    if (!(town.buildings.ranches || 0) || (totalAnim >= maxAnimCap && (town.buildings.ranches || 0) < 3)) {
      decisions.push({ priority: 45, action: 'build_ranch', townAction: 'build_ranch', description: `🐄 **${botName}** membangun **Peternakan** — ternak siap dipelihara!` });
    }
  }

  // ── ADVANCED BUILDINGS LAYER ──
  
  // Tier 2 Buildings
  if (town.tier >= 2) {
    if (!(town.buildings.schools || 0) && coins >= BUILDING_COSTS.school.coins && freeSlots >= 1) {
      decisions.push({ priority: 69, action: 'build_school', townAction: 'build_school', description: `🏫 **${botName}** membangun **Sekolah** — tingkat pendidikan meningkat!` });
    }
    if (!(town.buildings.towers || 0) && coins >= BUILDING_COSTS.tower.coins && freeSlots >= 1) {
      decisions.push({ priority: 68, action: 'build_tower', townAction: 'build_tower', description: `🛡️ **${botName}** membangun **Menara Pertahanan** — keamanan kota terjamin!` });
    }
    if (!(town.buildings.inns || 0) && coins >= BUILDING_COSTS.inn.coins && freeSlots >= 1) {
      decisions.push({ priority: 67, action: 'build_inn', townAction: 'build_inn', description: `🍻 **${botName}** membangun **Penginapan (Inn)** — pendapatan pajak bertambah!` });
    }
    if (!(town.buildings.hospitals || 0) && coins >= BUILDING_COSTS.hospital.coins && freeSlots >= 1) {
      decisions.push({ priority: 66, action: 'build_hospital', townAction: 'build_hospital', description: `🏥 **${botName}** mendirikan **Rumah Sakit** — kesehatan warga terjaga!` });
    }
    if (!(town.buildings.taverns || 0) && coins >= BUILDING_COSTS.tavern.coins && freeSlots >= 1) {
      decisions.push({ priority: 65, action: 'build_tavern', townAction: 'build_tavern', description: `🍺 **${botName}** membangun **Kedai Minum (Tavern)** — moral prajurit naik!` });
    }
  }

  // Tier 3 Buildings
  if (town.tier >= 3) {
    if (!(town.buildings.harbours || 0) && coins >= BUILDING_COSTS.harbour.coins && freeSlots >= 1) {
      decisions.push({ priority: 64, action: 'build_harbour', townAction: 'build_harbour', description: `⛵ **${botName}** membangun **Pelabuhan** — jalur dagang laut terbuka!` });
    }
    if (!(town.buildings.smithies || 0) && coins >= BUILDING_COSTS.smithy.coins && freeSlots >= 1) {
      decisions.push({ priority: 63, action: 'build_smithy', townAction: 'build_smithy', description: `⚒️ **${botName}** mendirikan **Pandai Besi** — siap menempa senjata!` });
    }
    if (!(town.buildings.workshops || 0) && coins >= BUILDING_COSTS.workshop.coins && freeSlots >= 1) {
      decisions.push({ priority: 62, action: 'build_workshop', townAction: 'build_workshop', description: `⚙️ **${botName}** membangun **Bengkel (Workshop)** — mesin kepung diproduksi!` });
    }
    if (!(town.buildings.stables || 0) && coins >= BUILDING_COSTS.stable.coins && freeSlots >= 1) {
      decisions.push({ priority: 61, action: 'build_stable', townAction: 'build_stable', description: `🐎 **${botName}** membangun **Kandang Kuda (Stable)** — kavaleri siap dilatih!` });
    }

    if (!(town.buildings.academies || 0) && coins >= BUILDING_COSTS.academy.coins && freeSlots >= 1) {
      decisions.push({ priority: 59, action: 'build_academy', townAction: 'build_academy', description: `🎓 **${botName}** mendirikan **Akademi** — pusat riset teknologi dimulai!` });
    }
  }

  // ── NEW MECHANICS LAYER (Phase 1-5) ──
  
  // Research Techs
  if ((town.buildings.academies || 0) > 0 && !town.research?.activeId) {
    if (!town.research?.unlockedTechs?.includes('advancedFarming') && coins >= 15) {
       decisions.push({ priority: 50, action: 'research_farm', townAction: 'research_advancedFarming', description: `🔬 **${botName}** memulai riset **Advanced Farming**!` });
    } else if (!town.research?.unlockedTechs?.includes('heavyInfantry') && coins >= 25) {
       decisions.push({ priority: 49, action: 'research_infantry', townAction: 'research_heavyInfantry', description: `🔬 **${botName}** memulai riset **Heavy Infantry**!` });
    }
  }

  // Hero Gacha (Generals)
  if (coins >= 50 && (town.generals?.length || 0) < 2) {
    decisions.push({ priority: 45, action: 'gacha_general', townAction: 'gacha_general', description: `🎲 **${botName}** merekrut Jenderal Legendaris di Tavern!` });
  }

  // Equip General
  if ((town.generals?.length || 0) > 0 && !town.activeGeneral) {
    const gen = town.generals![0];
    decisions.push({ priority: 80, action: 'equip_general', townAction: `equip_general_${gen}`, description: `👑 **${botName}** menunjuk Jenderal untuk memimpin kota!` });
  }

  // World Map Marching
  const activeMarches = town.marches?.filter(m => m.status !== 'completed').length || 0;
  if (activeMarches === 0 && (town.army?.infantry || 0) > 0) {
    if (Math.random() < 0.5) {
      decisions.push({ priority: 55, action: 'march_rebel', townAction: 'march_rebel', description: `⚔️ **${botName}** mengirimkan pasukan ke Peta Dunia untuk menumpas pemberontak!` });
    } else {
      decisions.push({ priority: 54, action: 'march_conquer', townAction: 'march_conquer', description: `🚩 **${botName}** mengekspansi kekuasaannya dan menjajah Tile baru di Peta Dunia!` });
    }
  }

  // Apply a randomizer (-10 to +10) to priority to avoid all bots acting identically
  // This ensures they don't all buy the exact same animals or build the exact same buildings simultaneously.
  for (const d of decisions) {
    d.priority += Math.floor(Math.random() * 21) - 10;
  }

  // Sort by priority descending (highest priority first)
  decisions.sort((a, b) => b.priority - a.priority);

  return decisions;
}

/**
 * Main Full AI Runner — Self-Learning Strategic Engine
 * Evaluates ALL possible actions, picks the top 3 by priority, executes them.
 * Bots adapt their behavior each tick based on current city metrics.
 */
export function runBotFullAI(db: any, botUserId: string, botName: string, isHumanAuto: boolean = false): string[] {
  const player = getPlayer(db, botUserId);
  const actions: string[] = [];

  // Ensure materials object exists
  if (!player.materials) player.materials = {};

  // Self-learn faction alignment if missing
  if (!player.faction) {
    const roll = Math.random();
    player.faction = roll < 0.33 ? 'Shu' : (roll < 0.66 ? 'Wei' : 'Wu');
    actions.push(`🚩 **${botName}** telah bersumpah setia kepada faksi **${player.faction}**!`);
  }

  // Update online timestamp
  player.lastActiveTime = Date.now();

  // Evaluate all strategies and execute top 3
  const strategies = evaluateStrategies(db, player, botName, isHumanAuto);
  let executed = 0;

  for (const decision of strategies) {
    if (executed >= 3) break; // Max 3 actions per tick

    if (decision.action === 'save_money') {
      actions.push(`💰 **${botName}** memilih untuk menabung hartanya saat ini.`);
      break; // Stop executing further actions to actually save the money
    }

    try {
      const { handleTownAction } = require('./town');
      const { handleResearchAction } = require('./research');
      const { handleGeneralAction } = require('./generals');
      const { handleMarchAction } = require('./marches');
      
      let successStr: any = null;
      if (decision.action.startsWith('research_')) {
        successStr = handleResearchAction(player, decision.townAction, db);
      } else if (decision.action === 'gacha_general' || decision.action === 'equip_general') {
        successStr = handleGeneralAction(player, decision.townAction, db);
      } else if (decision.action.startsWith('march_')) {
        successStr = handleMarchAction(player, decision.townAction, db);
      } else if (decision.action.startsWith('dungeon_')) {
        const { handleDungeonAction } = require('./dungeon_v2');
        successStr = handleDungeonAction(db, player, decision.townAction, botName);
      } else {
        successStr = handleTownAction(db, player, decision.townAction, botName);
      }
      
      if (typeof successStr === 'string' && !successStr.includes('❌')) {
        if (decision.description) actions.push(decision.description);
        pushDashboardLog(player, `[AI] ${decision.action}`);
        executed++;
      }
    } catch (err) {
      // Action failed (likely insufficient resources after previous actions), skip
      continue;
    }
  }

  // If no strategic actions available, do passive farming
  if (executed === 0) {
    // Passive Coin income from existing buildings
    const farmIncome = (player.town?.buildings.farms || 0) * 2;
    const marketIncome = (player.town?.buildings.marketplaces || 0) * 3;
    const totalIncome = Math.max(1, farmIncome + marketIncome);
    player.coins = (player.coins || 0) + totalIncome;
    actions.push(`🌾 **${botName}** mengumpulkan pajak dan hasil panen: **+${totalIncome} Coin**`);
  }

  saveMinigameDB(db);
  return actions;
}
