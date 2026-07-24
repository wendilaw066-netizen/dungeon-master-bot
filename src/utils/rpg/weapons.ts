import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { COLORS, fmt } from './ui';
import { inferSlotFromName, calculatePlayerStats } from './equipment';

// ============================================================
// WEAPON CATALOG — Rarity System
// ============================================================
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface WeaponItem {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  slot: 'weapon' | 'shield' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'necklace' | 'ring' | 'pet' | 'artifact';
  price?: number;        // Coin cost (only for shop items)
  priceGems?: number;    // Gems cost alternative
  atk: number;          // Flat ATK bonus
  hp: number;           // Flat HP bonus
  desc: string;
  source: 'shop' | 'dungeon' | 'gacha' | 'any';
}

export const RARITY_COLOR: Record<Rarity, number> = {
  Common:    0x9E9E9E,  // Grey
  Uncommon:  0x4CAF50,  // Green
  Rare:      0x2196F3,  // Blue
  Epic:      0x9C27B0,  // Purple
  Legendary: 0xFF8C00,  // Orange-gold
};

export const RARITY_EMOJI: Record<Rarity, string> = {
  Common:    '⬜',
  Uncommon:  '🟩',
  Rare:      '🟦',
  Epic:      '🟪',
  Legendary: '🟧',
};

// ============================================================
// SHOP WEAPONS — Normal/Common/Uncommon, buyable with Coin/Gems
// ============================================================
export const SHOP_WEAPONS: WeaponItem[] = [
  // ── Weapons ──────────────────────────────────────────────
  { id: `wooden_sword`,    name: `Wooden Sword`,     emoji: `${EMOJIS.res_wood}`, rarity: `Common`,   slot: `weapon`, price: 5,   atk: 15,  hp: 0,   desc: `Pedang pemula. Cukup untuk mengusir goblin.`, source: `shop` },
  { id: `iron_sword`,      name: `Iron Sword`,       emoji: `${EMOJIS.unit_infantry}`, rarity: `Common`,   slot: `weapon`, price: 15,  atk: 30,  hp: 0,   desc: `Pedang besi standar prajurit kota.`, source: `shop` },
  { id: 'steel_katana',    name: 'Steel Katana',     emoji: '🗡️', rarity: 'Uncommon', slot: 'weapon', price: 40,  atk: 55,  hp: 0,   desc: 'Katana dari baja tempa. Tipis tapi mematikan.', source: 'shop' },
  { id: 'hunters_bow',     name: "Hunter's Bow",     emoji: '🏹', rarity: 'Common',   slot: 'weapon', price: 12,  atk: 28,  hp: 0,   desc: 'Busur kayu sederhana untuk para pemburu.', source: 'shop' },
  { id: 'iron_crossbow',   name: 'Iron Crossbow',    emoji: '🏹', rarity: 'Uncommon', slot: 'weapon', price: 35,  atk: 50,  hp: 0,   desc: 'Senjata jarak jauh dengan daya tembus tinggi.', source: 'shop' },
  { id: 'apprentice_staff',name: 'Apprentice Staff', emoji: '🪄', rarity: 'Common',   slot: 'weapon', price: 10,  atk: 22,  hp: 10,  desc: 'Tongkat kayu bermuatan sedikit mana.', source: 'shop' },
  { id: 'mage_staff',      name: 'Mage Staff',       emoji: '🔮', rarity: 'Uncommon', slot: 'weapon', price: 45,  atk: 60,  hp: 15,  desc: 'Tongkat kristal yang memperkuat sihir.', source: 'shop' },
  { id: 'iron_dagger',     name: 'Iron Dagger',      emoji: '🔪', rarity: 'Common',   slot: 'weapon', price: 8,   atk: 20,  hp: 0,   desc: 'Pisau kecil, cepat dan murah.', source: 'shop' },

  // ── Armor ────────────────────────────────────────────────
  { id: 'leather_helmet',  name: 'Leather Helmet',   emoji: '⛑️', rarity: 'Common',   slot: 'helmet', price: 8,   atk: 0,   hp: 20,  desc: 'Pelindung kepala dari kulit keras.', source: 'shop' },
  { id: 'iron_helmet',     name: 'Iron Helmet',      emoji: '⛑️', rarity: 'Uncommon', slot: 'helmet', price: 25,  atk: 0,   hp: 40,  desc: 'Helm besi standar prajurit.', source: 'shop' },
  { id: 'leather_armor',   name: 'Leather Armor',    emoji: '🥋', rarity: 'Common',   slot: 'armor',  price: 12,  atk: 0,   hp: 35,  desc: 'Baju zirah kulit ringan.', source: 'shop' },
  { id: 'iron_armor',      name: 'Iron Armor',       emoji: '🥋', rarity: 'Uncommon', slot: 'armor',  price: 30,  atk: 0,   hp: 65,  desc: 'Baju zirah besi full body.', source: 'shop' },
  { id: `wooden_shield`,   name: `Wooden Shield`,    emoji: `${EMOJIS.btn_shield}`, rarity: `Common`,   slot: `shield`, price: 10,  atk: 0,   hp: 25,  desc: `Perisai kayu dasar.`, source: `shop` },
  { id: `iron_shield`,     name: `Iron Shield`,      emoji: `${EMOJIS.btn_shield}`, rarity: `Uncommon`, slot: `shield`, price: 28,  atk: 0,   hp: 55,  desc: `Perisai besi standar.`, source: `shop` },
  { id: 'leather_boots',   name: 'Leather Boots',    emoji: '👢', rarity: 'Common',   slot: 'boots',  price: 6,   atk: 0,   hp: 15,  desc: 'Sepatu kulit para petualang.', source: 'shop' },
  { id: 'iron_boots',      name: 'Iron Boots',       emoji: '👢', rarity: 'Uncommon', slot: 'boots',  price: 20,  atk: 0,   hp: 30,  desc: 'Sepatu besi berat tapi tangguh.', source: 'shop' },
  { id: 'leather_gloves',  name: 'Leather Gloves',   emoji: '🧤', rarity: 'Common',   slot: 'gloves', price: 5,   atk: 5,   hp: 10,  desc: 'Sarung tangan kulit standar.', source: 'shop' },
  { id: 'iron_gauntlet',   name: 'Iron Gauntlet',    emoji: '🧤', rarity: 'Uncommon', slot: 'gloves', price: 18,  atk: 10,  hp: 20,  desc: 'Sarung tangan besi kokoh.', source: 'shop' },

  // ── Accessories ──────────────────────────────────────────
  { id: 'copper_ring',     name: 'Copper Ring',      emoji: '💍', rarity: 'Common',   slot: 'ring',     price: 8,  atk: 8,   hp: 8,   desc: 'Cincin tembaga sederhana.', source: 'shop' },
  { id: 'silver_ring',     name: 'Silver Ring',      emoji: '💍', rarity: 'Uncommon', slot: 'ring',     price: 22, atk: 15,  hp: 15,  desc: 'Cincin perak dengan rune kecil.', source: 'shop' },
  { id: 'bone_necklace',   name: 'Bone Necklace',    emoji: '📿', rarity: 'Common',   slot: 'necklace', price: 7,  atk: 5,   hp: 12,  desc: 'Kalung tulang buatan suku primitif.', source: 'shop' },
];

// ============================================================
// DUNGEON DROPS — Rare/Epic weapons by difficulty
// ============================================================
export const DUNGEON_DROPS: Record<number, WeaponItem[]> = {
  // Normal (diff 0)
  0: [
    { id: `drp_crimson_sword`, name: `Crimson Sword`,    emoji: `${EMOJIS.unit_infantry}`, rarity: `Rare`,  slot: `weapon`, atk: 90,  hp: 0,   desc: `Pedang merah bara dari dungeon Normal.`, source: `dungeon` },
    { id: `drp_frost_shield`,  name: `Frost Shield`,     emoji: `${EMOJIS.btn_shield}`, rarity: `Rare`,  slot: `shield`, atk: 0,   hp: 120, desc: `Perisai beku yang memancarkan hawa dingin.`, source: `dungeon` },
    { id: 'drp_magic_ring',    name: 'Magic Ring',        emoji: '💍', rarity: 'Rare',  slot: 'ring',   atk: 25,  hp: 35,  desc: 'Cincin ajaib bertahtakan batu rubi.', source: 'dungeon' },
    { id: 'drp_wind_boots',    name: 'Wind Boots',        emoji: '👢', rarity: 'Rare',  slot: 'boots',  atk: 10,  hp: 40,  desc: 'Sepatu yang memanfaatkan energi angin.', source: 'dungeon' },
  ],
  // Hard (diff 1)
  1: [
    { id: 'drp_steel_katana',  name: 'Shadow Katana',    emoji: '🗡️', rarity: 'Rare',  slot: 'weapon', atk: 120, hp: 0,   desc: 'Katana tempa dari baja hitam langka.', source: 'dungeon' },
    { id: 'drp_titan_armor',   name: 'Titanium Armor',   emoji: '🥋', rarity: 'Rare',  slot: 'armor',  atk: 0,   hp: 180, desc: 'Zirah titanium yang hampir tidak bisa ditembus.', source: 'dungeon' },
    { id: 'drp_holy_amulet',   name: 'Holy Amulet',      emoji: '📿', rarity: 'Epic',  slot: 'necklace', atk: 30, hp: 60, desc: 'Jimat suci dari kuil kuno. HP regenerasi pasif.', source: 'dungeon' },
    { id: 'drp_storm_bow',     name: 'Storm Bow',         emoji: '🏹', rarity: 'Rare',  slot: 'weapon', atk: 110, hp: 0,   desc: 'Busur yang melesatkan panah petir.', source: 'dungeon' },
  ],
  // Nightmare (diff 2)
  2: [
    { id: 'drp_excalibur',     name: 'Excalibur',         emoji: '✨', rarity: 'Epic',  slot: 'weapon', atk: 200, hp: 50,  desc: 'Pedang legendaris Raja Arthur. Sangat langka.', source: 'dungeon' },
    { id: 'drp_dragonscale',   name: 'Dragon Scale Armor',emoji: '🥋', rarity: 'Epic',  slot: 'armor',  atk: 20,  hp: 300, desc: 'Zirah dari sisik naga. Hampir tidak hancur.', source: 'dungeon' },
    { id: 'drp_dragon_pet',    name: 'Baby Dragon',       emoji: '🐉', rarity: 'Epic',  slot: 'pet',    atk: 80,  hp: 150, desc: 'Bayi naga yang setia menemanimu bertempur.', source: 'dungeon' },
    { id: 'drp_emperor_ring',  name: 'Emperor Ring',      emoji: '💍', rarity: 'Epic',  slot: 'ring',   atk: 60,  hp: 80,  desc: 'Cincin Raja dari era kekaisaran kuno.', source: 'dungeon' },
  ],
  // Hell (diff 3)
  3: [
    { id: `drp_soul_blade`,    name: `Soul Blade`,        emoji: `${EMOJIS.unit_infantry}`, rarity: `Epic`,  slot: `weapon`, atk: 320, hp: 0,   desc: `Pedang yang memakan jiwa musuh yang dikalahkan.`, source: `dungeon` },
    { id: 'drp_cyber_suit',    name: 'Cyber-Suit',        emoji: '🥋', rarity: 'Epic',  slot: 'armor',  atk: 50,  hp: 500, desc: 'Baju zirah teknologi tinggi dari peradaban maju.', source: 'dungeon' },
    { id: 'drp_god_rune',      name: 'God Rune',          emoji: '🔮', rarity: 'Legendary', slot: 'artifact', atk: 100, hp: 200, desc: 'Rune para dewa. Hanya 1 dari 1000 petualang pernah menemukannya.', source: 'dungeon' },
  ],
  // Torment (diff 4)
  4: [
    { id: 'drp_rayman_fist',   name: 'Rayman Fist',       emoji: '👊', rarity: 'Legendary', slot: 'weapon', atk: 500, hp: 100, desc: 'Kepalan dewa yang merobek realita.', source: 'dungeon' },
    { id: 'drp_void_armor',    name: 'Void Armor',        emoji: '🌑', rarity: 'Legendary', slot: 'armor',  atk: 100, hp: 800, desc: 'Zirah kekosongan yang menyerap semua serangan.', source: 'dungeon' },
    { id: 'drp_oblivion_ring', name: 'Ring of Oblivion',  emoji: '⚫', rarity: 'Legendary', slot: 'ring',   atk: 200, hp: 200, desc: 'Cincin dari penguasa dimensi kegelapan.', source: 'dungeon' },
  ],
};

// ============================================================
// GACHA POOL — Mix of Rare/Epic/Legendary
// ============================================================
export const GACHA_POOL: Array<{ weapon: WeaponItem; weight: number }> = [
  // Legendary (1% total)
  { weapon: { id: 'g_rayman_fist',  name: 'Rayman Fist',      emoji: '👊', rarity: 'Legendary', slot: 'weapon',   atk: 500, hp: 100, desc: 'DROP LANGKA! Kepalan dewa.', source: 'gacha' }, weight: 0.5 },
  { weapon: { id: 'g_wings',        name: 'Da Vinci Wings',   emoji: '🦅', rarity: 'Legendary', slot: 'artifact', atk: 200, hp: 300, desc: 'Sayap ajaib buatan seniman dewa.', source: 'gacha' }, weight: 0.5 },
  // Epic (9%)
  { weapon: { id: 'g_excalibur',    name: 'Excalibur',        emoji: '✨', rarity: 'Epic', slot: 'weapon',   atk: 200, hp: 50,  desc: 'Pedang legendaris Raja Arthur.', source: 'gacha' }, weight: 2 },
  { weapon: { id: 'g_dragon_pet',   name: 'Baby Dragon',      emoji: '🐉', rarity: 'Epic', slot: 'pet',      atk: 80,  hp: 150, desc: 'Bayi naga setia dari gacha.', source: 'gacha' }, weight: 3 },
  { weapon: { id: 'g_golden_aura',  name: 'Golden Aura',      emoji: '✨', rarity: 'Epic', slot: 'artifact', atk: 80,  hp: 100, desc: 'Aura emas yang membalut tubuhmu.', source: 'gacha' }, weight: 4 },
  // Rare (30%)
  { weapon: { id: 'g_magic_ring',   name: 'Magic Ring',       emoji: '💍', rarity: 'Rare', slot: 'ring',     atk: 25,  hp: 35,  desc: 'Cincin ajaib bertahtakan rubi.', source: 'gacha' }, weight: 10 },
  { weapon: { id: 'g_holy_amulet',  name: 'Holy Amulet',      emoji: '📿', rarity: 'Rare', slot: 'necklace', atk: 30,  hp: 60,  desc: 'Jimat suci dari kuil kuno.', source: 'gacha' }, weight: 10 },
  { weapon: { id: 'g_storm_bow',    name: 'Storm Bow',        emoji: '🏹', rarity: 'Rare', slot: 'weapon',   atk: 110, hp: 0,   desc: 'Busur yang melesatkan panah petir.', source: 'gacha' }, weight: 10 },
  // Common consolation (60%)
  { weapon: { id: 'g_dirt_seed',    name: 'Dirt Seed',        emoji: '🌱', rarity: 'Common', slot: 'weapon', atk: 0,   hp: 0,   desc: 'Ampas. Nasibmu kurang beruntung hari ini.', source: 'gacha' }, weight: 60 },
];

// ============================================================
// WEAPON CATALOG HELPER FUNCTIONS
// ============================================================

/** Find a ShopWeapon by id or name */
export function findShopWeapon(query: string): WeaponItem | null {
  const q = query.toLowerCase().replace(/_/g, ' ').trim();
  return SHOP_WEAPONS.find(w =>
    w.id.replace(/_/g, ' ') === q ||
    w.name.toLowerCase() === q ||
    w.id === query.toLowerCase()
  ) ?? null;
}

/** Roll a random dungeon drop for a given difficulty. Returns null if no drop (50% chance) */
export function rollDungeonDrop(difficulty: number): WeaponItem | null {
  if (Math.random() > 0.40) return null; // 40% drop chance
  const pool = DUNGEON_DROPS[difficulty] ?? DUNGEON_DROPS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Roll gacha. Always returns something. */
export function rollGacha(forceEpic: boolean = false): WeaponItem {
  if (forceEpic) {
    const epics = GACHA_POOL.filter(e => e.weapon.rarity === 'Epic' || e.weapon.rarity === 'Legendary');
    return epics[Math.floor(Math.random() * epics.length)].weapon;
  }
  const totalWeight = GACHA_POOL.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const entry of GACHA_POOL) {
    r -= entry.weight;
    if (r <= 0) return entry.weapon;
  }
  return GACHA_POOL[GACHA_POOL.length - 1].weapon;
}

// ============================================================
// SHOP — Browse by category (Clickable Select Menus!)
// ============================================================
export function handleWeaponShopPage(
  db: MinigameDB, player: PlayerInventory, category: string
): { embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] } {
  const slotFilter: Record<string, string[]> = {
    weapon:    ['weapon'],
    armor:     ['armor', 'helmet', 'boots', 'gloves', 'shield'],
    accessory: ['ring', 'necklace', 'earrings', 'artifact', 'pet'],
  };
  const cat = category.toLowerCase();
  const slots = slotFilter[cat] || slotFilter.weapon;
  const items = SHOP_WEAPONS.filter(w => slots.includes(w.slot));

  const fields = items.map(w => ({
    name: RARITY_EMOJI[w.rarity] + ' ' + w.emoji + ' **' + w.name + '** — ' + w.rarity + '  |  💰 ' + w.price + ' Coin',
    value: 'ATK +**' + w.atk + '**  HP +**' + w.hp + '**  •  *' + w.desc + '*',
    inline: false,
  }));

  const embed = new EmbedBuilder()
    .setColor(COLORS.SHOP)
    .setTitle('🛒  WEAPON SHOP  —  ' + cat.toUpperCase())
    .setDescription(
      '> *"Semua senjata di sini sudah saya uji sendiri. Tinggal klik tombol di bawah untuk membeli!"* — Marcus\n\n' +
      '**Sumber item:**\n' +
      RARITY_EMOJI['Common'] + ' Common / ' + RARITY_EMOJI['Uncommon'] + ' Uncommon → **Beli di Shop**\n' +
      RARITY_EMOJI['Rare'] + ' Rare / ' + RARITY_EMOJI['Epic'] + ' Epic → **Dungeon** atau **Gacha**'
    )
    .addFields(fields.slice(0, 10))
    .setFooter({ text: 'Klik tombol di bawah untuk membeli item!' })
    .setTimestamp();

  const components: ActionRowBuilder<any>[] = [];

  for (let i = 0; i < Math.min(items.length, 10); i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const chunk = items.slice(i, i + 5);
    chunk.forEach(w => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('shopbuy_wp_' + w.id)
          .setLabel(w.name.length > 25 ? w.name.substring(0,25) : w.name)
          .setEmoji(w.emoji)
          .setStyle(ButtonStyle.Success)
      );
    });
    components.push(row);
  }

  const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`shopcat_wp_weapon`).setLabel(`Senjata`).setEmoji(`${EMOJIS.unit_infantry}`).setStyle(cat === `weapon` ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`shopcat_wp_armor`).setLabel(`Armor`).setEmoji(`${EMOJIS.btn_shield}`).setStyle(cat === `armor` ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_wp_accessory').setLabel('Aksesoris').setEmoji('💍').setStyle(cat === 'accessory' ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
  );
  
  components.push(rowNav);

  return { embeds: [embed], components };
}

export function handleWeaponShopBuy(
  db: MinigameDB, player: PlayerInventory, itemId: string
): { embeds: EmbedBuilder[] } {
  const weapon = findShopWeapon(itemId);

  if (!weapon || weapon.source === 'dungeon' || weapon.source === 'gacha') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌  Item Tidak Dijual di Sini')
      .setDescription(
        `**"${itemId}"** tidak tersedia di toko ini.\n\n` +
        `Item Rare/Epic/Legendary hanya bisa didapat dari:\n` +
        `${EMOJIS.unit_infantry} **Dungeon** — \`!dungeon\`\n` +
        `🎰 **Gacha** — \`!gacha\` (50 Coin)\n\n` +
        `Ketik \`!shop weapon\` untuk melihat item yang dijual.`
      );
    return { embeds: [embed] };
  }

  if (!weapon.price) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❌  Item Ini Tidak Untuk Dijual')
      .setDescription('Item ini tidak bisa dibeli. Cari cara lain untuk mendapatkannya!');
    return { embeds: [embed] };
  }

  if (player.coins < weapon.price) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle(`${weapon.emoji}  Dompet Tipis!`)
      .setDescription(
        `> *"Kamu kurang Coin, Sobat! Farming dulu!"* — Marcus\n\n` +
        `Butuh: **${weapon.price} Coin** | Kamu punya: **${player.coins} Coin**`
      );
    return { embeds: [embed] };
  }

  player.coins -= weapon.price;
  player.items.push(weapon.name);
  saveMinigameDB(db);

  const embed = new EmbedBuilder()
    .setColor(RARITY_COLOR[weapon.rarity])
    .setTitle(`${weapon.emoji}  Berhasil Membeli!`)
    .setDescription(`> *"Pilihan yang bagus! Kalahkan semua monster di luar sana!"* — Marcus`)
    .addFields(
      { name: `${RARITY_EMOJI[weapon.rarity]}  ${weapon.name}`,  value: weapon.desc, inline: false },
      { name: '${EMOJIS.unit_infantry}  ATK Bonus',    value: `+**${weapon.atk}**`, inline: true  },
      { name: '❤️  HP Bonus',     value: `+**${weapon.hp}**`,  inline: true  },
      { name: '💰  Dibayar',      value: `**${weapon.price} Coin**`, inline: true },
      { name: '🎒  Ditambahkan',  value: `Masuk ke tas. Ketik \`!equip ${weapon.name}\` untuk memakai!`, inline: false },
    )
    .setFooter({ text: `Sisa Coin: ${player.coins} Coin` })
    .setTimestamp();

  return { embeds: [embed] };
}

export function handleWeaponShopSell(
  db: MinigameDB, player: PlayerInventory, query: string
): { embeds: EmbedBuilder[] } | null {
  const q = query.toLowerCase().trim();
  const idx = player.items.findIndex(name => name.toLowerCase().includes(q));

  if (idx === -1) return null; // Item not found in equipment inventory

  const itemName = player.items[idx];
  
  // Try to find the item in our databases to get its rarity/price
  // 1. Check shop weapons
  let weaponObj: WeaponItem | undefined = SHOP_WEAPONS.find(w => w.name === itemName);
  if (!weaponObj) {
    // 2. Check dungeon drops
    for (const diff of Object.values(DUNGEON_DROPS)) {
      const found = diff.find(w => w.name === itemName);
      if (found) { weaponObj = found; break; }
    }
  }
  if (!weaponObj) {
    // 3. Check gacha
    const found = GACHA_POOL.find(w => w.weapon.name === itemName);
    if (found) weaponObj = found.weapon;
  }

  const rarity = weaponObj?.rarity || 'Common';
  
  // Base sell prices in Coins
  const raritySellPrices: Record<Rarity, number> = {
    Common: 3,
    Uncommon: 10,
    Rare: 25,
    Epic: 100,
    Legendary: 400
  };

  let sellPrice = raritySellPrices[rarity];
  if (weaponObj?.price) {
    sellPrice = Math.max(1, Math.floor(weaponObj.price / 2));
  }

  // Remove from inventory
  player.items.splice(idx, 1);
  player.coins += sellPrice;
  saveMinigameDB(db);

  const emoji = RARITY_EMOJI[rarity];
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS as any)
    .setTitle(`${emoji}  Berhasil Menjual Equipment!`)
    .setDescription(`Kamu menjual **${itemName}** (${rarity}) kepada Blacksmith.\n\n💰 +**${sellPrice} Coin** telah ditambahkan ke dompetmu!`)
    .setFooter({ text: `Sisa Coin: ${player.coins} Coin` });

  return { embeds: [embed] };
}
