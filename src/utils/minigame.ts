import { EMOJIS } from '../utils/rpg/emojis';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { EmbedBuilder } from 'discord.js';
import { COLORS, hpBar, fmt, wealthLine, durBar } from './rpg/ui';

const MINIGAME_DB_PATH = path.join(process.cwd(), 'minigame-db.json');

export interface EquipmentSlot {
  name: string | null;
  durability: number; // 0 to 100
  level?: number; // Upgrade level
}

export interface Character {
  id: string;
  name: string;
  element: 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';
  level: number;
  satisfaction: number;
  salary: number;
  role?: string;
  modifierDesc?: string;
  governorOf?: string;
  assignment?: {
    commanderyId: string;
    turnsLeft: number;
    type: 'suppress_rebellion' | 'tax_collection' | 'build_boost';
  };
  retinue: {
    infantry: number;
    archers: number;
    cavalry: number;
    spearmen?: number;
    catapults?: number;
  };
}

export interface FactionCourt {
  leader?: string;
  heir?: string;
  primeMinister?: string;
  chancellor?: string;
  grandCommandant?: string;
  prestige: number;
  rank: 'Marquis' | 'Duke' | 'King' | 'Emperor';
}

export interface ArmyMarch {
  id: string;
  targetId: string | null;
  targetX: number;
  targetY: number;
  startMs: number; // For rendering interpolated position
  arrivalMs: number;
  army: {
    infantry: number;
    archers: number;
    cavalry: number;
    spearmen: number;
    catapults: number;
    mercenaries?: number;
    factionUnits?: number;
  };
  type: 'attack_player' | 'attack_rebel' | 'conquer_tile' | 'attack_capital';
  status: 'marching' | 'returning' | 'completed';
}

export interface Deployment {
  id: string;
  missionType: 'DUNGEON' | 'WORLD_BOSS' | 'MAP_MARCH';
  troops: {
    infantry: number;
    archers: number;
    cavalry: number;
    spearmen: number;
    catapults: number;
  };
  targetId?: string; // e.g. 'world_boss' or dungeon level
  startTime: number;
  returnTime: number;
  status: 'active' | 'returning' | 'completed';
}

export interface WorldDisaster {
  id: string;
  type: 'blizzard' | 'plague' | 'drought';
  x: number;
  y: number;
  radius: number;
  durationMins: number;
  startMs: number;
  vx: number; // velocity x
  vy: number; // velocity y
}

export interface PlayerInventory {
  worldDisasters?: WorldDisaster[];
  activeDeployments?: Deployment[];
  characters?: Character[];
  gems: number;
  mana?: number;
  maxMana?: number;
  skillData?: Record<string, { level: number; exp: number }>;
  tutorialStep?: number; // 0-5 for FTUE onboarding
  gachaPulls?: number; // Pity counter
  activeBossBattle?: { hp: number; maxHp: number; state: string; name: string } | null;
  activeDungeonBattle?: {
    hp: number;
    maxHp: number;
    name: string;
    damage: number;
    diff: number;
    chap: number;
    stage: number;
    state?: string;
  } | null;
  taxPaid?: number; // Optional since old users might not have it
  eventBloodstones?: number; // Live-Ops Event
  factionId?: string | null;
  guildId?: string | null;
  currentRegion?: string;
  swarm?: {
    mysticWood: number;
    mysticAnimals: number;
    zooLevel: number;
    migrationTokens: number;
    dailyCatch: number;
    lastCatchDate: string;
  };
  gtItems?: string[]; // GT Item drops from dungeon (max 15)
  materials?: Record<string, number>; // Crafting materials
  coins: number;

  houses: number; // Passive income generator (legacy)
  pickaxeLevel: number; // Farming multiplier
  lastFarmTime: number;
  dailyQuests?: { type: string, target: number, progress: number, completed: boolean, description: string }[];
  lastDailyDate?: string;
  arenaRating?: number;
  pvpWins?: number;
  pvpLosses?: number;
  gachaPity?: number;
  titles?: string[];
  activeTitle?: string;
  activeArenaBattle?: any;
  pendingArenaChallenge?: string;
  storyProgress?: number; // Story Campaign chapter
  prestigeLevel?: number; // Kingdom Rebirth count (+25% per level)
  relics?: string[];       // Mythic artifacts
  loanAmount?: number;    // Bank credit loan
  dashboardLog?: string[];
  farmXp?: number;        // Farming experience points
  farmLevel?: number;     // Farming skill level
  dungeonXp?: number;     // Dungeon exploration experience
  dungeonLevel?: number;  // Dungeon mastery level
  loginStreak?: number;   // Consecutive login days
  lastLoginDate?: string; // Last login date (YYYY-MM-DD)
  discordName?: string;   // Discord username (updated on each interaction)
  autoPlayActive?: boolean; // AI idle grinding mode active (system bots)
  isAuto?: boolean;
  personality?: string;       // Player-toggled auto play mode
  seasonPoints?: number;  // Accumulated points for the weekly season
  lastActiveTime?: number; // Last activity timestamp
  lastUpkeepPaid?: number; // Last hourly upkeep payment timestamp
  equipment?: any;
  job?: any;
  
  // RPG Combat Expansion
  hp: number;
  maxHp: number;
  weaponLevel: number; // Legacy weapon level
  weaponName: string; // Legacy weapon
  items: string[];
  jailTime: number; // Timestamp until unjailed

  // V2 MMORPG Expansion
  dungeonProgress: {
    difficulty: number; // 0=Normal, 1=Hard, 2=Nightmare, 3=Hell, 4=Torment
    chapter: number; // 1 to 3
    stage: number; // 1 to 10
  };
  economy: {
    land: number;
    livestock: number;
    workers: number;
    workersStrike?: boolean;
  };
  faction?: 'Shu' | 'Wei' | 'Wu' | null;
  town?: {
    location?: { x: number, y: number };
    marches?: ArmyMarch[];
    conqueredTiles?: { x: number, y: number, type: string }[];
    activeParty?: string[]; // Array of up to 3 general names
    idleExpedition?: any;
    tier: number;           // 1=Village, 2=Town, 3=City, 4=Barony, 5=Duchy, 6=Kingdom
    landSlots: number;      // Total land owned (each = 4 build slots)
    buildings: {
      houses: number;       // 2 slots each, +2 villager cap
      farms: number;        // 1 slot each, +10% farm gems
      orchards: number;     // 4 slots each, fruit drops
      ranches: number;      // 2 slots each, holds 4 animals
      smithies: number;     // 4 slots each, +5% forge success (City+)
      quarries?: number;    // 2 slots each, generates stone & iron ore
      towers?: number;      // 2 slots each, repels bandit raids
      hospitals?: number;   // 2 slots each, auto-heals HP
      taverns?: number;     // 2 slots each, grants tavern ATK buff
      academies?: number;   // 4 slots each, unlocks research
      colosseums?: number;  // 4 slots each, city PvP arena
      kitchens?: number;    // 2 slots each, allows cooking meals
      treasuries?: number;  // 2 slots each, 2% daily interest
      wonders?: number;     // 4 slots each, World Wonder (High King status)
      wells?: number;       // 1 slot each, prevents fire disasters & boosts morale
      barracks?: number;    // 4 slots each, unlocks Infantry (City+)
      stables?: number;     // 4 slots each, unlocks Cavalry (City+)
      archeryRanges?: number; // 4 slots each, unlocks Archers (City+)
      lumberMills?: number; // Lumber mills
      marketplaces?: number; // Marketplaces
      harbours?: number;     // Harbours
      inns?: number;         // Inns
      schools?: number;      // Schools
      workshops?: number;    // 4 slots each, allows crafting Catapults
      warehouses?: number;   // Storage expansion
    };
    buildingLevels?: Record<string, number>; // e.g. { farm: 2, house: 3 }
    research?: {
      advancedFarming?: boolean;
      metallurgy?: boolean;
      activeId?: string | null;
      endTimestamp?: number;
      unlockedTechs?: string[];
    };
    activeDisaster?: string | null;
    traumaCount?: number; // Tracks raids taken (Merchant AI mutation)
    generals?: string[];
    activeGeneral?: string | null;
    morale?: number;               // 0 to 100
    tavernBuffUntil?: number;       // timestamp
    peaceShieldUntil?: number;      // timestamp for raid protection
    villagers: number;      // Current villager count
    army?: {
      infantry: number;
      archers: number;
      cavalry: number;
      spearmen?: number;
      catapults?: number;
      factionUnits?: number; // Tiger Cav, Zhuge Nu, Marines
      mercenaries?: number;  // Nanman, Xiongnu
      imperialGuards?: number; // T3 Infantry
    };
    covertOps?: {
      spies: number;
      assassins: number;
      saboteurs: number;
    };
    animals: {
      chickens: number;     // 1 Coin / 30m
      goats: number;        // 1 Coin / 15m
      cows: number;         // 1 Coin / 5m
      horses?: number;      // Speed / bonus yield
    };
    lastAnimalIncome: number; // timestamp for passive income throttle
    alliances?: string[];      // Array of allied player User IDs
    publicOrder?: number;      // -100 to +100
    corruption?: number;      // 0 to 100 percentage
    isTaxExempt?: boolean;
    court?: FactionCourt;
    prestige?: number;
    nobles?: number;           // Noble population count (available at City Tier 3+)
    royalFamily?: {
      members: string[];
      marriageCount: number;
      prestigeBonus: number;
    };
    food?: {
      rice: number;
      milk: number;
      meat: number;
      egg: number;
      wool: number;
    };
    weapons?: {
      sword: number;
      bow: number;
      spear: number;
      armor: number;
    };
    horses?: number;
    peasantChildren?: { ticksLeft: number }[];
    povertyRate?: number;
    hungerRate?: number;
  };
  activeSession?: {
    channelId: string;
    messageId: string;
  } | null;
  bank: {
    loanAmount: number;
    debtToPay: number;
    deadline: number; // Timestamp
  };
}

export interface MinigameDB {
  [userId: string]: PlayerInventory;
}

let memoryDB: MinigameDB | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

export function loadMinigameDB(): MinigameDB {
  if (memoryDB) return memoryDB; // Return from memory cache

  try {
    if (fs.existsSync(MINIGAME_DB_PATH)) {
      const data = fs.readFileSync(MINIGAME_DB_PATH, 'utf-8');
      memoryDB = JSON.parse(data);
      
      // Auto-migrate: Assign random locations to players without them
      // and perform Economy migration (WLs to Coins)
      let migrated = false;
      Object.keys(memoryDB!).forEach(id => {
        const p = memoryDB![id] as any;
        
        // ECONOMY MIGRATION
        if (p.wls !== undefined) {
          p.coins = p.wls;
          delete p.wls;
          migrated = true;
        }
        if (0 !== undefined) {
          
          migrated = true;
        }
        if (0 !== undefined) {
          
          migrated = true;
        }
        if (p.coins === undefined) {
          p.coins = 0;
          migrated = true;
        }

        // LOCATION MIGRATION
        if (id !== 'GLOBAL_STATE' && p.town && !p.town.location) {
          p.town.location = {
            x: Math.floor(Math.random() * 101) - 50,
            y: Math.floor(Math.random() * 101) - 50
          };
          migrated = true;
        }
      });
      if (migrated) saveMinigameDB(memoryDB!);

      // Pre-build GT item drop pool in background after DB loads
      setTimeout(() => buildItemDropPool(), 100);
      return memoryDB!;
    }
  } catch (error) {
    logger.error(`Error loading minigame DB: ${error}`, 'Minigame');
  }
  memoryDB = {};
  setTimeout(() => buildItemDropPool(), 100);
  return memoryDB;
}

export function saveMinigameDB(db: MinigameDB) {
  memoryDB = db; // Update cache
  if (!saveTimeout) {
    // Write-behind cache: delay write by 5 seconds to prevent I/O lag spikes
    saveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(MINIGAME_DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf-8');
      } catch (error) {
        logger.error(`Error saving minigame DB: ${error}`, 'Minigame');
      }
      saveTimeout = null;
    }, 5000);
  }
}

export function setPlayerName(db: MinigameDB, userId: string, username: string): void {
  if (db[userId]) {
    if (userId === '1104961692242292877') {
      db[userId].discordName = 'Hazzel';
    } else {
      db[userId].discordName = username;
    }
  }
}

export function getPlayer(db: MinigameDB, userId: string): PlayerInventory {
  let isNew = false;
  if (!db[userId]) {
    db[userId] = {} as PlayerInventory; // Initialize completely below
    isNew = true;
  }
  
  let p = db[userId];
  if (p.tutorialStep === undefined) p.tutorialStep = 5; // Default to finished for existing players
  if (p.gachaPulls === undefined) p.gachaPulls = 0;
  if (p.activeBossBattle === undefined) p.activeBossBattle = null;
  if (p.activeDungeonBattle === undefined) p.activeDungeonBattle = null;
  if (p.eventBloodstones === undefined) p.eventBloodstones = 0;
  
  if (p.maxMana === undefined) p.maxMana = 100;
  if (p.mana === undefined) p.mana = p.maxMana;
  if (p.skillData === undefined) p.skillData = {};
  if (p.currentRegion === undefined) p.currentRegion = 'Capital City';
  if (p.factionId === undefined) p.factionId = null;
  if (!p.swarm) {
    p.swarm = {
      mysticWood: 0,
      mysticAnimals: 0,
      zooLevel: 1,
      migrationTokens: 0,
      dailyCatch: 0,
      lastCatchDate: ''
    };
  }
  
  if (!p.economy) {
    p.economy = { land: 0, livestock: 0, workers: 0, workersStrike: false };
  } else if (p.economy.workersStrike === undefined) {
    p.economy.workersStrike = false;
  }
  
  // WIPE OUT LOGIC (BANKRUPTCY)
  // If the user has a debt deadline and the current time is past it, RESET THEM ENTIRELY.
  if (!isNew && p.bank && p.bank.deadline > 0 && p.bank.debtToPay > 0 && Date.now() > p.bank.deadline) {
    db[userId] = {} as PlayerInventory;
    p = db[userId];
    logger.warn(`User ${userId} failed to pay their loan in 24h! Account wiped out!`, 'Bank');
  }

  // Legacy migration
  if (p.gems === undefined) p.gems = 0;
  if (p.coins === undefined) p.coins = isNew ? 1000 : 0;
  
  
  if (p.houses === undefined) p.houses = 0;
  if (p.pickaxeLevel === undefined) p.pickaxeLevel = 1;
  if (p.lastFarmTime === undefined) p.lastFarmTime = 0;
  if (p.hp === undefined) p.hp = 100;
  if (p.maxHp === undefined) p.maxHp = 100;
  if (p.weaponLevel === undefined) p.weaponLevel = 1;
  if (p.weaponName === undefined) p.weaponName = 'Wooden Sword';
  if (p.items === undefined) p.items = [];
  if (p.jailTime === undefined) p.jailTime = 0;

  // V2 MMORPG migration
  if (!p.dungeonProgress) {
    p.dungeonProgress = { difficulty: 0, chapter: 1, stage: 1 };
  }
  if (p.prestigeLevel === undefined) p.prestigeLevel = 0;
  if (p.loanAmount === undefined) p.loanAmount = 0;
  if (!p.relics) p.relics = [];
  if (!p.economy) {
    p.economy = { land: 0, livestock: 0, workers: 0 };
  }
  if (!p.bank) {
    p.bank = { loanAmount: 0, debtToPay: 0, deadline: 0 };
  }
  if (p.lastUpkeepPaid === undefined) {
    p.lastUpkeepPaid = Date.now();
  }

  if (p.faction === undefined) p.faction = null;

  // Town system migration
  if (!p.town) {
    p.town = {
      tier: 1,
      landSlots: 1,
      buildings: { 
        houses: 1, farms: 0, orchards: 0, ranches: 0, smithies: 0, quarries: 0, 
        towers: 0, hospitals: 0, taverns: 0, academies: 0, colosseums: 0, 
        kitchens: 0, treasuries: 0, wonders: 0, wells: 1, barracks: 0, 
        stables: 0, archeryRanges: 0, lumberMills: 0, marketplaces: 1, 
        harbours: 0, inns: 0, schools: 0 
      },
      buildingLevels: { 
        house: 1, farm: 1, orchard: 1, ranch: 1, smithy: 1, quarry: 1, 
        tower: 1, lumberMill: 1, marketplace: 1, harbour: 1, inn: 1, school: 1 
      },
      research: { advancedFarming: false, metallurgy: false, activeId: null, endTimestamp: 0, unlockedTechs: [] },
      morale: 100,
      villagers: 2,
      animals: { chickens: 0, goats: 0, cows: 0, horses: 0 },
      lastAnimalIncome: Date.now(),
      food: { rice: 20, milk: 10, meat: 10, egg: 5, wool: 5 },
      weapons: { sword: 0, bow: 0, spear: 0, armor: 0 },
      horses: 0,
      peasantChildren: [],
      povertyRate: 0,
      hungerRate: 0
    };
  } else {
    if (!p.town.buildings) p.town.buildings = { houses: 1, farms: 0, orchards: 0, ranches: 0, smithies: 0 };
    if (p.town.buildings.quarries === undefined) p.town.buildings.quarries = 0;
    if (p.town.buildings.towers === undefined) p.town.buildings.towers = 0;
    if (p.town.buildings.hospitals === undefined) p.town.buildings.hospitals = 0;
    if (p.town.buildings.taverns === undefined) p.town.buildings.taverns = 0;
    if (p.town.buildings.academies === undefined) p.town.buildings.academies = 0;
    if (p.town.buildings.colosseums === undefined) p.town.buildings.colosseums = 0;
    if (p.town.buildings.kitchens === undefined) p.town.buildings.kitchens = 0;
    if (p.town.buildings.treasuries === undefined) p.town.buildings.treasuries = 0;
    if (p.town.buildings.wonders === undefined) p.town.buildings.wonders = 0;
    if (p.town.buildings.wells === undefined) p.town.buildings.wells = 1;
    if (p.town.buildings.barracks === undefined) p.town.buildings.barracks = 0;
    if (p.town.buildings.stables === undefined) p.town.buildings.stables = 0;
    if (p.town.buildings.archeryRanges === undefined) p.town.buildings.archeryRanges = 0;
    if (p.town.buildings.lumberMills === undefined) p.town.buildings.lumberMills = 0;
    if (p.town.buildings.marketplaces === undefined) p.town.buildings.marketplaces = 1;
    if (p.town.buildings.harbours === undefined) p.town.buildings.harbours = 0;
    if (p.town.buildings.inns === undefined) p.town.buildings.inns = 0;
    if (p.town.buildings.schools === undefined) p.town.buildings.schools = 0;

    if (!p.town.army) p.town.army = { infantry: 0, archers: 0, cavalry: 0, factionUnits: 0, mercenaries: 0, imperialGuards: 0 };
    if (!p.town.covertOps) p.town.covertOps = { spies: 0, assassins: 0, saboteurs: 0 };
    if (!p.town.animals) p.town.animals = { chickens: 0, goats: 0, cows: 0 };
    if (p.town.animals.horses === undefined) p.town.animals.horses = 0;
    if (!p.town.buildingLevels) p.town.buildingLevels = { house: 1, farm: 1, orchard: 1, ranch: 1, smithy: 1, quarry: 1, tower: 1 };
    if (!p.town.research) p.town.research = { advancedFarming: false, metallurgy: false, activeId: null, endTimestamp: 0, unlockedTechs: [] };
    if (!p.town.research.unlockedTechs) p.town.research.unlockedTechs = [];
    if (p.town.morale === undefined) p.town.morale = 100;
    if (!p.town.food) p.town.food = { rice: 20, milk: 10, meat: 10, egg: 5, wool: 5 };
    if (!p.town.weapons) p.town.weapons = { sword: 0, bow: 0, spear: 0, armor: 0 };
    if (p.town.horses === undefined) p.town.horses = 0;
    if (!p.town.peasantChildren) p.town.peasantChildren = [];
    if (p.town.povertyRate === undefined) p.town.povertyRate = 0;
    if (p.town.hungerRate === undefined) p.town.hungerRate = 0;
  }



  return p;
}


// ==========================================
// ACTIONS
// ==========================================

import { calculateOfflinePassiveIncome, handleEconomyBuy } from './rpg/economy';
import { buildItemDropPool } from './rpg/items';
import { calculatePlayerStats, SLOT_NAMES } from './rpg/equipment';

export function farm(userId: string, ownerId: string | null = null): { embeds: EmbedBuilder[] } | string {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  const now = Date.now();

  // ── Error states ──
  if (player.jailTime > now) {
    const left = Math.ceil((player.jailTime - now) / 1000);
    const e = new EmbedBuilder().setColor(COLORS.BANK_WARN)
      .setTitle('👮  Kamu Di Balik Jeruji!')
      .setDescription(`Kamu masih dipenjara selama **${left} detik** lagi. Mau kabur? Bayar denda dulu!`);
    return { embeds: [e] };
  }
  if (player.hp <= 0) {
    const e = new EmbedBuilder().setColor(0x2C3E50)
      .setTitle('☠️  Kamu Pingsan!')
      .setDescription('Kamu tidak bisa farming saat pingsan. Pergi ke **Tavern** untuk istirahat atau ketik `!heal`.');
    return { embeds: [e] };
  }
  if (now - player.lastFarmTime < 60000) {
    const left = Math.ceil((60000 - (now - player.lastFarmTime)) / 1000);
    const e = new EmbedBuilder().setColor(COLORS.INFO)
      .setTitle('⏳  Masih Cooldown...')
      .setDescription(`Kamu kelelahan! Istirahat **${left} detik** lagi sebelum bisa farming kembali.`);
    return { embeds: [e] };
  }

  // ── Compute drops ──
  const { coins: passiveCoins, healed } = calculateOfflinePassiveIncome(player, now);
  player.lastFarmTime = now;

  const baseDrop = Math.floor(Math.random() * 3) + 1;
  let drop = baseDrop + Math.floor((player.pickaxeLevel || 1) / 2);
  if (player.houses > 0) drop += player.houses * 1;

  // 15% Chance of Critical Harvest!
  const isCritical = Math.random() < 0.15;
  if (isCritical) {
    drop *= 2;
  }

  const totalGain = drop + passiveCoins;

  // ── Tax ──
  let tax = 0;
  if (ownerId && userId !== ownerId) {
    tax = Math.ceil(totalGain * 0.10);
    const owner = getPlayer(db, ownerId);
    owner.coins = (owner.coins || 0) + tax;
  }
  const netGain = totalGain - tax;
  player.coins = (player.coins || 0) + netGain;

  // ── Event Drops (Blood Moon) ──
  let gotBloodstone = false;
  if (Math.random() < 0.3) {
    player.eventBloodstones = (player.eventBloodstones || 0) + 1;
    gotBloodstone = true;
  }

  // ── RANDOM ENCOUNTERS (25% chance) ──
  let eventTitle = '';
  let eventText = '';
  let eventBonus = '';
  const rollEvent = Math.random();

  if (rollEvent < 0.25) {
    const eventType = Math.floor(Math.random() * 4);
    if (eventType === 0) {
      // Ancient Golden Chest
      const coinBonus = Math.floor(Math.random() * 30) + 15;
      player.coins = (player.coins || 0) + coinBonus;
      eventTitle = '🌟 PETI EMAS KUNO TERBONGKAR!';
      eventText = 'Kamu tidak sengaja mencangkul peti berlapis emas kuno yang terkubur! Dengan sekali hantaman pickaxe, peti itu terbuka!';
      eventBonus = `${EMOJIS.res_mystic} **+${coinBonus.toLocaleString()} Coin** tambahan ditemukan!`;
    } else if (eventType === 1) {
      // Bandit Ambush
      const stats = calculatePlayerStats(player);
      if (stats.attack > 100) {
        player.coins += 5;
        eventTitle = `${EMOJIS.unit_infantry} SERANGAN BANDIT (BERHASIL DIATASI)!`;
        eventText = 'Dua orang bandit lokal melompat keluar dari semak-semak! Namun melihat ATK-mu yang tinggi, kamu berhasil menghajar mereka dan merampas kantongnya!';
        eventBonus = `${EMOJIS.res_coin} **+5 Coin** dirampas dari bandit!`;
      } else {
        player.hp = Math.max(10, player.hp - 25);
        eventTitle = '🏃 DISERANG BANDIT!';
        eventText = 'Kamu disergap oleh sekelompok bandit jalanan! Kamu terpaksa melarikan diri, namun terkena tebasan!';
        eventBonus = `🩸 Kehilangan **25 HP** saat kabur!`;
      }
    } else if (eventType === 2) {
      // Wishing Well
      if (player.coins >= 1) {
        player.coins -= 1;
        const rewards = [
          'HP terpulihkan sepenuhnya!',
          'Coin melimpah ruah (+20 Coin)!',
          'Mana terisi penuh!'
        ];
        const rIdx = Math.floor(Math.random() * rewards.length);
        if (rIdx === 0) {
          player.hp = player.maxHp;
        } else if (rIdx === 1) {
          player.coins = (player.coins || 0) + 20;
        } else {
          player.mana = player.maxMana;
        }
        eventTitle = '⛲ SUMUR KEBERUNTUNGAN';
        eventText = 'Kamu menemukan sumur tua ajaib. Kamu melemparkan **1 Coin** untuk memohon sesuatu...';
        eventBonus = `✨ Keinginan terkabul: **${rewards[rIdx]}**`;
      }
    } else {
      // Lucky Ore
      if (!player.materials) player.materials = {};
      player.materials['Iron Ore'] = (player.materials['Iron Ore'] || 0) + 2;
      eventTitle = `${EMOJIS.res_iron} METEORIT JATUH!`;
      eventText = 'Kamu menemukan serpihan meteorit kecil yang mengandung besi murni berkilau!';
      eventBonus = `🧱 **+2 Iron Ore** ditambahkan ke tas!`;
    }
  }

  saveMinigameDB(db);

  // Flavour texts
  const ACTIONS = [
    `${EMOJIS.res_iron} Kamu memecah batu besar dan menemukan Coin peninggalan kuno!`,
    `${EMOJIS.res_grain} Kerja keras di ladang membuahkan hasil yang manis!`,
    '🌲 Kamu menebang pohon tua dan menemukan harta tersembunyi!',
    '🎣 Memancing di sungai mistis 💧 dan apa yang naik? Sekantong Coin!',
    '🧭 Kamu menjelajahi reruntuhan dan menemukan peti tersembunyi!',
  ];
  const flavour = isCritical 
    ? '✨ **CRITICAL HARVEST!** Cangkulmu membentur urat emas raksasa!' 
    : ACTIONS[Math.floor(Math.random() * ACTIONS.length)];

  const embed = new EmbedBuilder()
    .setColor(isCritical ? 0xE74C3C : COLORS.FARM)
    .setTitle(isCritical ? '💥 CRITICAL HARVEST! 💥' : '🌾 HASIL FARMING')
    .setDescription(flavour)
    .addFields(
      { name: `${EMOJIS.res_coin} Pendapatan Koin`, value: `+**${fmt(drop)}** Coin ${isCritical ? '*(2x CRIT!)*' : `*(Pickaxe Lv.${player.pickaxeLevel})*`}`, inline: true },
      { name: '💖 HP', value: `${healed ? '+(Pasif)' : ''} ${Math.floor(player.hp)} / ${player.maxHp}`, inline: true },
      { name: '💼 Passive Income', value: `Pekerja menghasilkan **+${fmt(passiveCoins)} Coin** sejak farming terakhir!`, inline: false },
      { name: '👑 Pajak Owner', value: tax > 0 ? `-${fmt(tax)} Coin` : '—', inline: true },
      { name: '✅ Net Diterima', value: `**+${fmt(netGain)} Coin** 🎉`, inline: true },
      { name: '💰 Total Coin', value: `**${fmt(player.coins)} Coin**`, inline: true }
    );

  if (gotBloodstone) {
    embed.addFields({ name: '🩸 EVENT: Blood Moon', value: '+1 **Bloodstone**! Tukarkan di `!shop event`', inline: false });
  }

  if (eventTitle) {
    embed.addFields({ name: `⚡ ACARA ACAK: ${eventTitle}`, value: `${eventText}\n> **Efek:** ${eventBonus}`, inline: false });
  }

  embed.setFooter({ text: healed ? '🐄 Ternakmu memulihkan sebagian HP saat kamu offline.' : '⏰ Cooldown farming: 60 detik' })
       .setTimestamp();

  return { embeds: [embed] };
}

export function buy(userId: string, item: string, amount: number = 1): string {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  item = item.toLowerCase();
  
  // Cek kalau item itu item economy sandbox
  const economyResult = handleEconomyBuy(db, player, item, amount);
  if (economyResult) return economyResult;
  
  // Logic buy lama (wl, dl, bgl, house, pickaxe, weapon, medkit)
  if (item === 'wl' || item === 'coins') {
    // Support !buy wl max — beli sebanyak mungkin sekaligus
    const pricePerWl = 2000;
    if (amount <= 0 || isNaN(amount)) amount = 1;
    // Kalau 'max', hitung berapa yang bisa dibeli
    const rawArg = item; // placeholder - amount sudah di-parse caller
    // We check by checking if amount is extraordinarily large as sentinel: caller passes 999999 for max
    const isMax = (amount === 999999);
    if (isMax) {
      amount = Math.floor(player.gems / pricePerWl);
      if (amount <= 0) return `❌ Gems kamu tidak cukup untuk beli 1 Coin pun! Butuh **${pricePerWl} Gems** per Coin, kamu punya ${player.gems} Gems.`;
    }
    const cost = pricePerWl * amount;
    if (player.gems < cost) {
      const canAfford = Math.floor(player.gems / pricePerWl);
      return `❌ Kurang Gems! Beli **${amount} Coin** butuh **${cost.toLocaleString()} Gems**.\nKamu punya **${player.gems.toLocaleString()} Gems** — hanya bisa beli **${canAfford} Coin** sekarang.\n💡 Tips: ketik \`!buy wl max\` untuk beli semua yang bisa dibeli sekaligus!`;
    }
    player.gems -= cost;
    player.coins += amount;
    saveMinigameDB(db);
    return `🛍️ Berhasil beli **${amount} Coin** seharga **${cost.toLocaleString()} Gems**! (Sisa Gems: ${player.gems.toLocaleString()})`;

    
  } else if (item === 'dl' || item === 'dls') {
    const cost = 100 * amount;
    if (player.coins < cost) return `Kurang modal! Butuh **${cost} Coin** buat beli ${amount} DL. Kamu cuma punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    
    saveMinigameDB(db);
    return `🛍️ Upgrade ke **${amount} DL** seharga ${cost} Coin berhasil! (Sultan mode on)`;
    
  } else if (item === 'bgl' || item === 'bgls') {
    const cost = 100 * amount;
    if (0 < cost) return `Belum setara admin! Butuh **${cost} DL** buat cetak ${amount} BGL. Kamu cuma punya ${0} DL.`;
    
    
    
    saveMinigameDB(db);
    return `👑 SAH! Berhasil mencetak **${amount} BGL** seharga ${cost} DL. GGWP!`;
    
  } else if (item === 'house' || item === 'rumah') {
    const cost = 5 * amount; // 5 Coin per house
    if (player.coins < cost) return `Mandor ngamuk! Butuh **${cost} Coin** buat bangun ${amount} Rumah. Kamu punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    player.houses += amount;
    saveMinigameDB(db);
    return `🏠 Berhasil ngebangun **${amount} Rumah**! Mulai sekarang dapet bonus +50 Gems tiap kali farming.`;
    
  } else if (item === 'pickaxe' || item === 'upgrade') {
    player.pickaxeLevel = player.pickaxeLevel || 1;
    if (player.pickaxeLevel >= 10) return `Pickaxe kamu udah Max Level (Lv.10)! Udah dewa bro.`;
    
    const cost = player.pickaxeLevel * 10;
    if (player.coins < cost) return `Kurang Coin bang! Upgrade ke Pickaxe Lv.${player.pickaxeLevel + 1} butuh **${cost} Coin**. Kamu cuma punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    player.pickaxeLevel += 1;
    saveMinigameDB(db);
    return `${EMOJIS.res_iron} *TING!* Pickaxe berhasil diupgrade ke **Level ${player.pickaxeLevel}**! (Gems farming x${player.pickaxeLevel})`;
    
  } else if (item === 'weapon') {
    if (player.weaponLevel >= 10) return `Senjatamu udah Max Level (Lv.10)! Udah dewa bro.`;
    
    const cost = player.weaponLevel * 15;
    if (player.coins < cost) return `Kurang Coin bang! Upgrade ke Weapon Lv.${player.weaponLevel + 1} butuh **${cost} Coin**. Kamu cuma punya ${player.coins} Coin.`;
    
    player.coins -= cost;
    player.weaponLevel += 1;
    
    const weaponNames = ['Wooden Sword', 'Iron Broadsword', 'Steel Katana', 'Titanium Blade', 'Crimson Edge', 'Frostmourne', 'Excalibur', 'Sonic Buster Katana', 'Demonic Soul Aura', 'Rayman Fist'];
    player.weaponName = weaponNames[Math.min(player.weaponLevel - 1, weaponNames.length - 1)];
    
    saveMinigameDB(db);
    return `${EMOJIS.unit_infantry} *SHING!* Legacy Weapon berhasil diupgrade menjadi **${player.weaponName} (Lv.${player.weaponLevel})**!`;
    
  } else if (item === 'medkit') {
    const cost = 2; // 2 Coin per medkit
    if (player.coins < cost * amount) return `BPJS mu nunggak! Butuh **${cost * amount} Coin** buat beli ${amount} Medkit.`;
    
    player.coins -= cost * amount;
    for(let i=0; i<amount; i++) player.items.push('Medkit');
    saveMinigameDB(db);
    return `💉 Berhasil beli **${amount} Medkit**! Gunakan \`!heal\` saat sakaratul maut.`;
    
  // ── EVENT ITEMS ──
  } else if (item === 'bloodpot' || item === 'bloodtkn' || item === 'bloodscy' || item === 'mysticwood' || item === 'goldennet') {
    const costMap: Record<string, { p: number, unit: string }> = { 
      bloodpot: { p: 3, unit: 'bloodstones' }, 
      bloodtkn: { p: 20, unit: 'bloodstones' }, 
      bloodscy: { p: 150, unit: 'bloodstones' },
      mysticwood: { p: 5, unit: 'migrationTokens' },
      goldennet: { p: 100, unit: 'migrationTokens' }
    };
    const nameMap: Record<string, string> = { 
      bloodpot: 'Blood Potion', 
      bloodtkn: 'Blood Moon Token', 
      bloodscy: 'Vampiric Scythe',
      mysticwood: 'Mystic Wood',
      goldennet: 'Golden Net'
    };
    
    const meta = costMap[item];
    const cost = meta.p * amount;
    
    if (meta.unit === 'bloodstones') {
      if ((player.eventBloodstones || 0) < cost) {
        return `🩸 Kurang Bloodstones! Butuh **${cost}**, kamu punya ${player.eventBloodstones || 0}.`;
      }
      player.eventBloodstones = (player.eventBloodstones || 0) - cost;
    } else if (meta.unit === 'migrationTokens') {
      if (!player.swarm || player.swarm.migrationTokens < cost) {
        return `🦋 Kurang Migration Tokens! Butuh **${cost}**, kamu punya ${player.swarm?.migrationTokens || 0}.`;
      }
      player.swarm.migrationTokens -= cost;
      if (item === 'mysticwood') {
        player.swarm.mysticWood += amount;
      }
    }
    
    if (item !== 'mysticwood') {
      for(let i=0; i<amount; i++) player.items.push(nameMap[item]);
    }
    saveMinigameDB(db);
    return `✨ Berhasil menukarkan **${cost} ${meta.unit}** dengan **${amount}x ${nameMap[item]}**!`;
  }
  
  return `Barang apa itu? Cek kategori dengan \`!shop event\`.`;
}

export function checkInventory(userId: string) {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  const otherItems = player.items || [];
  const gtItems = player.gtItems || [];

  const wealthVal = `🔑 **World Lock (Coin):** \`${player.coins}\`  •  💸 **Diamond Lock (DL):** \`${0}\``;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🎒 Treasury Stockpile — ${player.discordName || userId}`)
    .setDescription(wealthVal)
    .addFields(
      {
        name: '🎒 Bag Items',
        value: otherItems.length > 0 ? otherItems.map(i => `• ${i}`).join('\n') : '*Empty*',
        inline: true
      },
      {
        name: '🎁 GT Equipment Loot',
        value: gtItems.length > 0 ? gtItems.map(i => `• ${i}`).join('\n') : '*None*',
        inline: true
      }
    )
    .setTimestamp();

  return { embeds: [embed] };
}

export function heal(userId: string): string {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  
  calculatePlayerStats(player);
  if (player.hp >= player.maxHp && (player.mana || 0) >= (player.maxMana || 100)) return `Darah & Mana kamu udah penuh bro! Nggak usah sok sakit.`;
  
  const medkitIndex = player.items.indexOf('Medkit');
  if (medkitIndex !== -1) {
    player.items.splice(medkitIndex, 1);
    player.hp = player.maxHp;
    player.mana = player.maxMana || 100;
    saveMinigameDB(db);
    return `🏥 Kamu pakai Medkit dari tas. Nyawa & Mana kembali penuh (${player.maxHp} HP, ${player.mana} 🔵)!`;
  }
  
  const cost = 5;
  if (player.coins < 10) {
    player.hp = player.maxHp;
    player.mana = player.maxMana || 100;
    saveMinigameDB(db);
    return `🏥 Berhubung kamu lagi miskin (Coin < 10), kamu dirawat di klinik gratis! Nyawa & Mana kembali penuh (${player.maxHp} HP, ${player.mana} 🔵)!`;
  }
  
  player.coins -= cost;
  player.hp = player.maxHp;
  player.mana = player.maxMana || 100;
  saveMinigameDB(db);
  return `🏥 Kamu dirawat di rumah sakit elit. Bayar ${cost} Coin, Nyawa & Mana penuh lagi (${player.maxHp} HP, ${player.mana} 🔵)!`;
}

export function dungeon(userId: string, ownerId: string | null = null): string {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  const now = Date.now();
  
  if (player.jailTime > now) return `👮 Kamu masih dipenjara!`;
  if (player.hp <= 0) return `☠️ Kamu pingsan! Ketik \`!heal\` dulu.`;
  
  // RNG Monster Battle
  const monsterPower = Math.floor(Math.random() * 20) + 1; // 1-20
  const myPower = player.weaponLevel + Math.floor(Math.random() * 5); // Base weapon + RNG
  
  let msg = `🐉 Kamu masuk ke gua dan bertemu monster Level ${monsterPower}! (Kekuatanmu: ${myPower})\\n`;
  
  if (myPower > monsterPower + 5) {
    // Easy win
    let loot = Math.floor(Math.random() * 1000) + 500;
    
    let tax = 0;
    if (ownerId && userId !== ownerId) {
      tax = Math.ceil(loot * 0.10);
      const owner = getPlayer(db, ownerId);
      owner.gems += tax;
    }
    
    player.gems += (loot - tax);
    msg += `🗡️ Menang telak! Dapet **${loot - tax} Gems** tanpa lecet sedikitpun!`;
    if (tax > 0) msg += ` *(Pajak Owner: ${tax} Gems)*`;
    
  } else if (myPower >= monsterPower) {
    // Hard win
    let loot = Math.floor(Math.random() * 500) + 200;
    player.gems += loot;
    const damage = Math.floor(Math.random() * 30) + 10;
    player.hp -= damage;
    msg += `${EMOJIS.unit_infantry} Menang susah payah! Dapet **${loot} Gems** tapi terluka dan kena *damage* **-${damage} HP**. (Sisa HP: ${player.hp}/${player.maxHp})`;
  } else {
    // Lose
    const damage = Math.floor(Math.random() * 50) + 30;
    player.hp -= damage;
    if (player.hp < 0) player.hp = 0;
    msg += `💥 KALAH TELAK! Kamu dihajar monster dan kena *damage* **-${damage} HP**. (Sisa HP: ${player.hp}/${player.maxHp})`;
  }
  
  saveMinigameDB(db);
  return msg;
}

export function rob(robberId: string, victimId: string): string {
  if (robberId === victimId) return `Jangan nyuri dari diri sendiri kocak.`;
  const db = loadMinigameDB();
  const robber = getPlayer(db, robberId);
  const victim = getPlayer(db, victimId);
  const now = Date.now();
  
  if (robber.jailTime > now) return `👮 Kamu masih dipenjara!`;
  if (robber.hp <= 0) return `☠️ Lu lagi koma, ngapain nyolong.`;
  
  if (victim.coins < 1) return `Kasihan, targetmu kere (0 Coin). Cari mangsa lain!`;
  
  // Rob success chance based on weapon difference
  const baseChance = 30;
  const chance = baseChance + (robber.weaponLevel * 2) - (victim.weaponLevel * 2);
  const rng = Math.floor(Math.random() * 100);
  
  if (rng < chance) {
    // Sukses merampok 10% dari Coin korban
    let stealAmount = Math.max(1, Math.floor(victim.coins * 0.1));
    victim.coins -= stealAmount;
    robber.coins += stealAmount;
    saveMinigameDB(db);
    return `🥷 **SUKSES MERAMPOK!** Kamu ngebegal target dan dapat **${stealAmount} Coin**. GG!`;
  } else {
    // Gagal -> Dipenjara 3 menit dan HP -20
    robber.hp -= 20;
    robber.jailTime = now + (3 * 60 * 1000); // 3 menit
    saveMinigameDB(db);
    return `🚓 **KETAHUAN POLISI!** Target ngelawan dan lapor polisi. Kamu digebukin (-20 HP) dan dipenjara selama 3 menit!`;
  }
}


export function gacha(userId: string): { embeds: EmbedBuilder[] } {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  const cost = 50;
  if (player.coins < cost) {
    const e = new EmbedBuilder().setColor(COLORS.BANK_WARN)
      .setTitle('🎰  Gacha SSB — Kurang Coin')
      .setDescription('Butuh **' + cost + ' Coin** untuk buka gacha.\nPunya lu: **' + player.coins + ' Coin**\nFarming dulu yuk!');
    return { embeds: [e] };
  }
  // Lazy-load weapon catalog
  const W = require('./rpg/weapons') as any;
  player.coins -= cost;
  
  // Pity logic
  player.gachaPulls = (player.gachaPulls || 0) + 1;
  const isPity = player.gachaPulls >= 10;
  
  const item = W.rollGacha(isPity) as any;
  
  if (item.rarity === 'Epic' || item.rarity === 'Legendary') {
    player.gachaPulls = 0; // Reset pity
  }

  const isJunk = item.id === 'g_dirt_seed';
  if (!isJunk) player.items.push(item.name);
  saveMinigameDB(db);

  const rarityColor: number = (W.RARITY_COLOR as Record<string,number>)[item.rarity] ?? 0x95a5a6;
  const rarityEmoji: string = (W.RARITY_EMOJI as Record<string,string>)[item.rarity] ?? '';
  const banners: Record<string, string> = {
    Legendary: '🌟  L E G E N D A R Y  🌟',
    Epic:      '💜  E P I C  💜',
    Rare:      '💙  R A R E  💙',
    Uncommon:  '💚  Uncommon',
    Common:    '⬜  Common',
  };
  const praise: Record<string, string> = {
    Legendary: '🎊 **SELAMAT! Item LEGENDARIS sangat langka!**',
    Epic:      '🎊 **WOW! Item Epic masuk tas!**',
    Rare:      '👍 Lumayan! Item Rare.',
    Uncommon:  '🤷 Standar.',
    Common:    '😢 Apes hari ini...',
  };
  const embed = new EmbedBuilder()
    .setColor(rarityColor as any)
    .setTitle('🎰  GACHA SSB  —  Spent ' + cost + ' Coin')
    .setDescription((banners[item.rarity] ?? '') + '\n' + (praise[item.rarity] ?? ''))
    .addFields({
      name:  rarityEmoji + '  ' + (item.emoji ?? '') + '  ' + item.name + '  (' + item.rarity + ')',
      value: item.desc + (isJunk ? `` : `\n\n${EMOJIS.unit_infantry} ATK +**` + item.atk + `**  •  ❤️ HP +**` + item.hp + `**`),
      inline: false,
    });
  if (!isJunk) {
    embed.addFields({
      name:  '🎒  Item Masuk Tas',
      value: 'Ketik `!equip ' + item.name + '` untuk memakainya!',
      inline: false,
    });
  }
  embed.setFooter({ text: 'Sisa Coin: ' + player.coins + ' Coin  •  Rate: 1% Legendary, 9% Epic, 30% Rare' }).setTimestamp();
  return { embeds: [embed] };
}

