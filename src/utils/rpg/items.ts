import { EMOJIS } from './emojis';
import * as fs from 'fs';
import * as path from 'path';
import { EmbedBuilder } from 'discord.js';
import { PlayerInventory, saveMinigameDB, MinigameDB } from '../minigame';
import { COLORS } from './ui';

// ============================================================
// TYPES
// ============================================================
export interface GtItem {
  item: string;
  description: string;
  image?: string;
}

export interface GtItemDB {
  [key: string]: GtItem;
}

export interface GtPriceEntry {
  item: string;
  priceRange: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export type GtRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface DroppedGtItem {
  name: string;
  rarity: GtRarity;
  sellPrice: number; // in Gems
}

// ============================================================
// DATA LOADING (cached at startup)
// ============================================================
const ITEMS_PATH  = path.join(process.cwd(), 'growtopia-items.json');
const PRICES_PATH = path.join(process.cwd(), 'growtopia-prices.json');

let _itemsCache: GtItemDB | null = null;
let _pricesCache: Record<string, GtPriceEntry> | null = null;

// Categorized pool for dungeon drops (equipment only, no blocks/decorations)
const dropPool: Record<GtRarity, string[]> = {
  Common:    [],
  Uncommon:  [],
  Rare:      [],
  Epic:      [],
  Legendary: [],
};
let poolBuilt = false;

function loadItemsDB(): GtItemDB {
  if (_itemsCache) return _itemsCache;
  try {
    _itemsCache = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
    return _itemsCache!;
  } catch {
    return {};
  }
}

function loadPricesDB(): Record<string, GtPriceEntry> {
  if (_pricesCache) return _pricesCache;
  try {
    _pricesCache = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf-8'));
    return _pricesCache!;
  } catch {
    return {};
  }
}

// ============================================================
// RARITY DETECTION — based on Growtopia item description keywords
// ============================================================

// Keywords that suggest a block / decoration (EXCLUDE from equipment pool)
const BLOCK_KEYWORDS = [
  'block', 'seed', 'place this', 'placed', 'place it', 'in your world',
  'wall', 'floor', 'ceiling', 'background', 'tile', 'door', 'gate',
  'checkpoint', 'shrine', 'pedestal', 'brazier', 'lamp', 'pot', 'vase',
  'stool', 'shelf', 'frame', 'poster', 'sign', 'fence', 'lock your world',
  'world lock', 'cable', 'vent', 'duct', 'pipe', 'railing', 'panel',
  'mooncake', 'strudel', 'fossil', 'candlestick', 'tombstone',
  'platform', 'brick', 'glass', 'stone', 'dirt', 'lava', 'couch', 'chair',
  'table', 'bed', 'candle', 'carpet', 'rug', 'painting', 'fountain',
  'statue', 'pillar', 'column', 'stair', 'ladder', 'scaffolding', 'crate',
  'barrel', 'box', 'chest', 'mirror', 'curtain', 'banner', 'signboard'
];

// Keywords that suggest wearable / equipment (INCLUDE in pool)
const EQUIP_KEYWORDS = [
  'wear', 'equipped', 'equip', 'wings', 'cape', 'cloak', 'suit', 'outfit',
  'shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'vest', 'robe',
  'gloves', 'gauntlet', 'shoes', 'boots', 'sandals', 'sneakers',
  'hat', 'helmet', 'hood', 'crown', 'mask', 'beret', 'cap', 'headband',
  'necklace', 'amulet', 'pendant', 'choker', 'collar',
  'ring', 'bracelet', 'earring', 'wristband',
  'sword', 'blade', 'scythe', 'staff', 'wand', 'hammer', 'axe', 'dagger',
  'shield', 'bow', 'rifle', 'gun', 'cannon', 'whip', 'fist',
  'artifact', 'orb', 'tome', 'spellbook',
  'leash', 'pet', 'companion', 'creature', 'animal',
  'hair', 'wig', 'afro', 'bun', 'ponytail',
  'eyes', 'glasses', 'monocle', 'goggles', 'shades',
  'mustache', 'beard', 'stubble',
  'backpack', 'sling', 'bag',
  'aura', 'halo', 'glow',
];

function detectRarity(name: string, desc: string): GtRarity | null {
  const lowerDesc = desc.toLowerCase();
  const lowerName = name.toLowerCase();

  // Exclude blocks and seeds
  for (const kw of BLOCK_KEYWORDS) {
    if (lowerDesc.includes(kw) || lowerName.includes(kw)) return null;
  }

  // Must have at least one equip keyword
  const isEquipment = EQUIP_KEYWORDS.some(kw => lowerName.includes(kw) || lowerDesc.includes(kw));
  if (!isEquipment) return null;

  // Classify rarity from description
  if (lowerDesc.includes('legendary') || lowerDesc.includes('god') || lowerDesc.includes('ultimate')) return 'Legendary';
  if (lowerDesc.includes('epic') || lowerDesc.includes('mystical') || lowerDesc.includes('ethereal') || lowerDesc.includes('ancient')) return 'Epic';
  if (lowerDesc.includes('rare') || lowerDesc.includes('special') || lowerDesc.includes('powerful') || lowerDesc.includes('heroic')) return 'Rare';
  if (lowerDesc.includes('uncommon') || lowerDesc.includes('unusual') || lowerDesc.includes('unique')) return 'Uncommon';
  return 'Common';
}

// ============================================================
// BUILD DROP POOL (called once on startup)
// ============================================================
export function buildItemDropPool(): void {
  if (poolBuilt) return;
  const db = loadItemsDB();

  for (const [, entry] of Object.entries(db)) {
    // Skip malformed entries (those with | in the key = corrupted data)
    if (entry.item.includes('|')) continue;
    const rarity = detectRarity(entry.item, entry.description);
    if (!rarity) continue;

    // Filter out cheap items (must be at least 5 Coins / 10,000 Gems estimated price)
    const price = estimateSellPrice(entry.item, rarity);
    if (price < 10000) continue;

    dropPool[rarity].push(entry.item);
  }

  poolBuilt = true;
  console.log(`[Items] Drop pool built: Common=${dropPool.Common.length} Uncommon=${dropPool.Uncommon.length} Rare=${dropPool.Rare.length} Epic=${dropPool.Epic.length} Legendary=${dropPool.Legendary.length}`);
}

// ============================================================
// SELL PRICE ESTIMATION
// ============================================================
const RARITY_SELL_PRICE: Record<GtRarity, number> = {
  Common:    500,
  Uncommon:  2000,
  Rare:      8000,
  Epic:      25000,
  Legendary: 100000,
};

function estimateSellPrice(itemName: string, rarity: GtRarity): number {
  const prices = loadPricesDB();
  const key = itemName.toLowerCase();
  if (prices[key]) {
    // Parse price from string like "100 Coin" / "5 DL" / "100 Gems"
    const raw = prices[key].priceRange;
    const wlMatch = raw.match(/(\d+[\d,]*)\s*Coin/i);
    const dlMatch = raw.match(/(\d+[\d,]*)\s*DL/i);
    const gemMatch = raw.match(/(\d+[\d,]*)\s*Gems/i);
    if (dlMatch)  return parseInt(dlMatch[1].replace(',', '')) * 100 * 2000;  // 1 DL = 100 Coin = 200,000 gems
    if (wlMatch)  return parseInt(wlMatch[1].replace(',', '')) * 2000;         // 1 Coin = 2,000 gems
    if (gemMatch) return parseInt(gemMatch[1].replace(',', ''));
  }
  return RARITY_SELL_PRICE[rarity];
}

// ============================================================
// DUNGEON ITEM DROP ROLLER
// ============================================================
export const RARITY_EMOJI_GT: Record<GtRarity, string> = {
  Common:    '⚪',
  Uncommon:  '🟢',
  Rare:      '🔵',
  Epic:      '🟣',
  Legendary: '🟡',
};

// Probability of each rarity dropping (per difficulty tier 0-4)
const DROP_TABLES: Record<number, { chance: number; pool: GtRarity[] }> = {
  0: { chance: 0.20, pool: ['Common', 'Common', 'Common', 'Uncommon'] },
  1: { chance: 0.25, pool: ['Common', 'Uncommon', 'Uncommon', 'Rare'] },
  2: { chance: 0.30, pool: ['Uncommon', 'Rare', 'Rare', 'Epic'] },
  3: { chance: 0.35, pool: ['Rare', 'Epic', 'Epic', 'Legendary'] },
  4: { chance: 0.40, pool: ['Epic', 'Epic', 'Legendary', 'Legendary'] },
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function rollGtItemDrop(diff: number): DroppedGtItem | null {
  if (!poolBuilt) buildItemDropPool();

  const table = DROP_TABLES[Math.min(diff, 4)];
  if (Math.random() > table.chance) return null; // No drop

  const rarity = pick(table.pool);
  const pool = dropPool[rarity];
  if (!pool || pool.length === 0) return null;

  const itemName = pick(pool);
  return {
    name: itemName,
    rarity,
    sellPrice: estimateSellPrice(itemName, rarity),
  };
}

// Roll a guaranteed item from specific rarities (used for World Boss)
export function rollSpecificGtItemDrop(allowedRarities: GtRarity[]): DroppedGtItem | null {
  if (!poolBuilt) buildItemDropPool();
  const rarity = pick(allowedRarities);
  // dropPool is internal but accessible here
  const pool = dropPool[rarity];
  if (!pool || pool.length === 0) return null;

  const itemName = pick(pool);
  return {
    name: itemName,
    rarity,
    sellPrice: estimateSellPrice(itemName, rarity),
  };
}

// ============================================================
// ITEM LOOKUP — !item <query>
// ============================================================
export function buildItemLookupEmbed(query: string): EmbedBuilder {
  const db = loadItemsDB();
  const prices = loadPricesDB();

  const q = query.toLowerCase().trim();

  // 1. Exact match
  let found: GtItem | null = db[q] ?? null;
  let foundKey = q;

  // 2. Partial match (starts with)
  if (!found) {
    for (const [k, v] of Object.entries(db)) {
      if (k.startsWith(q) && !k.includes('|')) {
        found = v;
        foundKey = k;
        break;
      }
    }
  }

  // 3. Contains match
  if (!found) {
    for (const [k, v] of Object.entries(db)) {
      if (k.includes(q) && !k.includes('|')) {
        found = v;
        foundKey = k;
        break;
      }
    }
  }

  if (!found) {
    return new EmbedBuilder()
      .setColor(COLORS.BANK_WARN as any)
      .setTitle('❌ Item Not Found')
      .setDescription(`Item **"${query}"** tidak ditemukan di database Growtopia.\nCoba ketik nama yang lebih spesifik.`);
  }

  const rarity = detectRarity(found.item, found.description) ?? 'Common';
  const rarityEmoji = RARITY_EMOJI_GT[rarity];
  const priceEntry = prices[foundKey];

  const embed = new EmbedBuilder()
    .setColor(rarity === 'Legendary' ? 0xFFD700 : rarity === 'Epic' ? 0x9B59B6 : rarity === 'Rare' ? 0x3498DB : rarity === 'Uncommon' ? 0x2ECC71 : 0x95A5A6 as any)
    .setTitle(`${rarityEmoji} ${found.item}`)
    .setDescription(`*${found.description}*`)
    .addFields(
      { name: '🏷️ Rarity',   value: `${rarityEmoji} **${rarity}**`,                                                          inline: true },
      { name: '${EMOJIS.res_mystic} Sell Est.', value: `~${(estimateSellPrice(found.item, rarity) / 2000).toFixed(1)} Coin`,                      inline: true },
      { name: '📈 Harga Pasar', value: priceEntry ? `**${priceEntry.priceRange}** ${priceEntry.trend === 'UP' ? '📈' : priceEntry.trend === 'DOWN' ? '📉' : '➡️'}` : '*Tidak tersedia*', inline: false },
    )
    .setFooter({ text: 'Data dari Growtopia Item Database • Gunakan !jual <nama> untuk menjual item' });

  if (found.image) embed.setThumbnail(found.image);

  return embed;
}

// ============================================================
// INVENTORY DISPLAY — !inv gt
// ============================================================
export function buildGtInvEmbed(player: PlayerInventory, userName: string): EmbedBuilder {
  const gtItems = player.gtItems ?? [];

  if (gtItems.length === 0) {
    return new EmbedBuilder()
      .setColor(COLORS.INFO as any)
      .setTitle(`🎒 GT Inventory — ${userName}`)
      .setDescription('Kamu belum punya item Growtopia.\nMenangkan dungeon untuk mendapatkan item drop!');
  }

  const db = loadItemsDB();
  const lines = gtItems.map((name, i) => {
    const key = name.toLowerCase();
    const entry = db[key];
    const rarity = entry ? (detectRarity(entry.item, entry.description) ?? 'Common') : 'Common';
    const emoji = RARITY_EMOJI_GT[rarity];
    const sellEst = estimateSellPrice(name, rarity);
    return `${i + 1}. ${emoji} **${name}** — ~${(sellEst / 2000).toFixed(1)} Coin`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS as any)
    .setTitle(`🎒 GT Inventory — ${userName}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${gtItems.length}/15 slot terisi • !jual <nama> untuk menjual • !item <nama> untuk info detail` });
}

// ============================================================
// SELL ITEM — !jual <nama>
// ============================================================
export function sellGtItem(db: MinigameDB, player: PlayerInventory, query: string): string {
  const gtItems = player.gtItems ?? [];
  if (gtItems.length === 0) return '❌ Kamu tidak punya item GT untuk dijual.';

  const q = query.toLowerCase().trim();
  const idx = gtItems.findIndex(name => name.toLowerCase().includes(q));

  if (idx === -1) return `❌ Item **"${query}"** tidak ada di inventorimu (Baik Equip maupun GT Item).\nCek dengan \`!inv\` atau \`!inv gt\`.`;

  const itemName = gtItems[idx];
  const itemDB = loadItemsDB();
  const key = itemName.toLowerCase();
  const entry = itemDB[key];
  const rarity = entry ? (detectRarity(entry.item, entry.description) ?? 'Common') : 'Common';
  const sellPrice = estimateSellPrice(itemName, rarity);

  // Remove from inventory
  player.gtItems = gtItems.filter((_, i) => i !== idx);
  player.gems += sellPrice;
  saveMinigameDB(db);

  const emoji = RARITY_EMOJI_GT[rarity];
  return `${emoji} Berhasil menjual **${itemName}** (${rarity})!\n${EMOJIS.res_mystic} +**${sellPrice.toLocaleString()} Gems** masuk ke kantongmu.`;
}
