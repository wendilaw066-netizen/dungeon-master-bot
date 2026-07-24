import { PlayerInventory, EquipmentSlot, saveMinigameDB, MinigameDB } from '../minigame';
import { getJobBonusMultiplier } from './jobs';
import { loadGuilds } from './guilds';

export const SLOT_NAMES = ['weapon', 'shield', 'helmet', 'armor', 'gloves', 'boots', 'necklace', 'earrings', 'ring', 'pet', 'artifact'] as const;
type SlotName = typeof SLOT_NAMES[number];

// Lazy-load weapon catalog to avoid circular deps at module init
let _catalogCache: Array<{ name: string; atk: number; hp: number; slot?: SlotName }> | null = null;
function loadCatalogSafe() {
  if (_catalogCache) return _catalogCache;
  try {
    const W = require('./weapons') as any;
    const allDrops = Object.values(W.DUNGEON_DROPS as Record<number, any[]>).flat();
    const gacha    = (W.GACHA_POOL as Array<{ weapon: any }>).map(e => e.weapon);
    _catalogCache  = [...(W.SHOP_WEAPONS as any[]), ...allDrops, ...gacha];
    
    const C = require('./crafting') as any;
    if (C.RECIPES) {
      for (const r of Object.values(C.RECIPES) as any[]) {
        _catalogCache.push({ name: r.name, atk: r.baseAtk || 0, hp: r.baseHp || 0, slot: r.type });
      }
    }
  } catch { _catalogCache = []; }
  return _catalogCache!;
}

export function getItemStats(itemName: string): { hp: number; attack: number } {
  // 1. Exact name lookup in weapon catalog
  const cat = loadCatalogSafe();
  const found = cat.find(w => w.name.toLowerCase() === itemName.toLowerCase());
  if (found) return { hp: found.hp ?? 0, attack: found.atk ?? 0 };

  // 2. Keyword fallback for legacy / unknown items
  let hp = 0, attack = 0;
  const n = itemName.toLowerCase();
  if (n.includes('sword') || n.includes('blade') || n.includes('katana') || n.includes('bow') || n.includes('gun') || n.includes('fist')) attack += 20;
  if (n.includes('shield'))                          hp += 30;
  if (n.includes('helmet') || n.includes('cap'))     hp += 15;
  if (n.includes('armor')  || n.includes('suit') || n.includes('robe')) hp += 40;
  if (n.includes('glove')  || n.includes('gauntlet')) { hp += 5; attack += 5; }
  if (n.includes('boot')   || n.includes('shoe'))    hp += 10;
  if (n.includes('ring')   || n.includes('necklace') || n.includes('amulet')) { hp += 10; attack += 10; }
  if (n.includes('pet')    || n.includes('dragon') || n.includes('wolf')) { hp += 50; attack += 20; }
  if (n.includes('artifact') || n.includes('rune') || n.includes('crystal') || n.includes('aura') || n.includes('wings')) { hp += 100; attack += 50; }
  if (n.includes('iron'))                                          { hp *= 1.2; attack *= 1.2; }
  if (n.includes('steel') || n.includes('shadow'))                 { hp *= 1.5; attack *= 1.5; }
  if (n.includes('titanium'))                                      { hp *= 2;   attack *= 2;   }
  if (n.includes('demonic') || n.includes('holy'))                 { hp *= 3;   attack *= 3;   }
  if (n.includes('cyber')  || n.includes('mecha'))                 { hp *= 4;   attack *= 4;   }
  if (n.includes('god') || n.includes('emperor') || n.includes('void') || n.includes('oblivion')) { hp *= 8; attack *= 8; }
  return { hp: Math.floor(hp), attack: Math.floor(attack) };
}

export function inferSlotFromName(itemName: string): SlotName | null {
  // Try to find exactly in catalog first to cover names like "Excalibur"
  const cat = loadCatalogSafe();
  // Sort catalog by name length descending to match longest possible base name first
  const sortedCat = [...cat].sort((a, b) => b.name.length - a.name.length);
  const found = sortedCat.find(w => itemName.toLowerCase().includes(w.name.toLowerCase()));
  if (found && (found as any).slot) {
    return (found as any).slot as SlotName;
  }

  const name = itemName.toLowerCase();
  if (name.includes('excalibur')) return 'weapon';
  
  if (name.includes('sword') || name.includes('blade') || name.includes('katana') || name.includes('bow') || name.includes('gun') || name.includes('fist') || name.includes('staff') || name.includes('spear') || name.includes('dagger') || name.includes('axe') || name.includes('wand') || name.includes('scythe') || name.includes('hammer')) return 'weapon';
  if (name.includes('shield') || name.includes('buckler') || name.includes('aegis')) return 'shield';
  if (name.includes('helmet') || name.includes('cap') || name.includes('hood') || name.includes('crown') || name.includes('mask') || name.includes('helm') || name.includes('circlet')) return 'helmet';
  if (name.includes('armor') || name.includes('chest') || name.includes('robe') || name.includes('suit') || name.includes('tunic') || name.includes('plate') || name.includes('mail') || name.includes('cloak')) return 'armor';
  if (name.includes('glove') || name.includes('gauntlet') || name.includes('bracer')) return 'gloves';
  if (name.includes('boot') || name.includes('shoe') || name.includes('sandal') || name.includes('greaves')) return 'boots';
  if (name.includes('necklace') || name.includes('amulet') || name.includes('pendant')) return 'necklace';
  if (name.includes('earring')) return 'earrings';
  if (name.includes('ring') || name.includes('band')) return 'ring';
  if (name.includes('pet') || name.includes('dragon') || name.includes('wolf') || name.includes('cat') || name.includes('dog') || name.includes('bird')) return 'pet';
  if (name.includes('artifact') || name.includes('rune') || name.includes('crystal') || name.includes('talisman') || name.includes('gem') || name.includes('orb')) return 'artifact';
  
  return null;
}

export function calculatePlayerStats(player: PlayerInventory): { maxHp: number; attack: number; maxMana: number } {
  let baseHp = 100; // Legacy base
  let baseAtk = player.weaponLevel * 10; // Legacy base logic
  
  // Add equipment stats (only if durability > 0)
  for (const slot of SLOT_NAMES) {
    const eq = player.equipment[slot] as EquipmentSlot;
    if (eq.name && eq.durability > 0) {
      const stats = getItemStats(eq.name);
      // level +1 gives +10% stats
      const levelMultiplier = 1 + ((eq.level || 0) * 0.1);
      baseHp += Math.floor(stats.hp * levelMultiplier);
      baseAtk += Math.floor(stats.attack * levelMultiplier);
    }
  }
  
  const jobMultipliers = getJobBonusMultiplier(player);
  
  let guildBuff = 1.0;
  if (player.guildId) {
    const guilds = loadGuilds();
    if (guilds[player.guildId]) {
      guildBuff = 1.0 + (guilds[player.guildId].level * 0.05); // +5% per level
    }
  }

  const finalHp = Math.floor(baseHp * jobMultipliers.hp * guildBuff);
  const finalAtk = Math.floor(baseAtk * jobMultipliers.attack * guildBuff);
  const finalMaxMana = 100 + (player.weaponLevel * 10);
  
  // Ensure player reflects this
  player.maxHp = finalHp;
  player.maxMana = finalMaxMana;
  if (player.mana === undefined || player.mana > player.maxMana) player.mana = player.maxMana;
  
  return { maxHp: finalHp, attack: finalAtk, maxMana: finalMaxMana };
}

export function handleEquip(db: MinigameDB, player: PlayerInventory, itemName: string): string {
  const itemIndex = player.items.findIndex(i => i.toLowerCase() === itemName.toLowerCase());
  if (itemIndex === -1) return `Barang "${itemName}" tidak ada di tas kamu!`;
  
  const actualItemName = player.items[itemIndex];
  const targetSlot = inferSlotFromName(actualItemName);
  
  if (!targetSlot) return `Sistem bingung! "${actualItemName}" itu dipasang di bagian mana?`;
  
  // Swap if something is already equipped
  const currentEquipped = player.equipment[targetSlot] as EquipmentSlot;
  if (currentEquipped.name) {
    player.items.push(currentEquipped.name);
  }
  
  // Equip new item with full durability if fresh, or 100 as default
  player.equipment[targetSlot] = { name: actualItemName, durability: 100 };
  
  // Remove from items
  player.items.splice(itemIndex, 1);
  
  // Recalculate stats
  calculatePlayerStats(player);
  saveMinigameDB(db);
  
  return `👕 Sukses memasang **${actualItemName}** ke slot [${targetSlot.toUpperCase()}]. Stats kamu meningkat!`;
}

export function handleUnequip(db: MinigameDB, player: PlayerInventory, slot: string): string {
  const targetSlot = slot.toLowerCase() as SlotName;
  if (!SLOT_NAMES.includes(targetSlot)) return `Slot "${slot}" tidak valid! Coba: weapon, armor, ring, dll.`;
  
  const currentEquipped = player.equipment[targetSlot] as EquipmentSlot;
  if (!currentEquipped.name) return `Slot [${targetSlot.toUpperCase()}] memang kosong!`;
  
  player.items.push(currentEquipped.name);
  player.equipment[targetSlot] = { name: null, durability: 100 };
  
  // Recalculate stats
  calculatePlayerStats(player);
  // Cap HP if it exceeds new max HP
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  
  saveMinigameDB(db);
  return `🎒 Kamu melepas **${currentEquipped.name}** dan memasukkannya ke tas.`;
}

export function handleRepair(db: MinigameDB, player: PlayerInventory, itemName: string): string {
  // Find in equipment
  let foundSlot: SlotName | null = null;
  for (const slot of SLOT_NAMES) {
    const eq = player.equipment[slot] as EquipmentSlot;
    if (eq.name && eq.name.toLowerCase() === itemName.toLowerCase()) {
      foundSlot = slot;
      break;
    }
  }
  
  if (!foundSlot) return `Barang "${itemName}" tidak sedang kamu pakai! Pakai dulu (\`!equip\`) baru direpair.`;
  
  const eq = player.equipment[foundSlot] as EquipmentSlot;
  if (eq.durability === 100) return `Barang **${eq.name}** masih mulus 100%, nggak usah diperbaiki!`;
  
  let cost = 5; // 5 Coin per repair
  if (player.town?.research?.unlockedTechs?.includes('metallurgy') || player.town?.research?.metallurgy) {
    cost = 4; // 20% discount
  }
  let requiredMaterial = 'Wood';
  const n = eq.name?.toLowerCase() || '';
  if (n.includes('iron') || n.includes('sword') || n.includes('armor')) requiredMaterial = 'Iron Ore';
  if (n.includes('magic') || n.includes('staff') || n.includes('robe')) requiredMaterial = 'Magic Dust';
  if (n.includes('dragon') || n.includes('excalibur')) requiredMaterial = 'Dragon Scale';

  if (!player.materials) player.materials = {};
  const matCount = player.materials[requiredMaterial] || 0;
  
  if (player.coins < cost) return `Kurang modal! Bengkel minta **${cost} Coin** buat benerin ${eq.name}.`;
  if (matCount < 1) return `Kurang material! Bengkel minta **1x ${requiredMaterial}** untuk memperbaiki ${eq.name} (Kamu punya ${matCount}). Cari di Dungeon!`;
  
  player.coins -= cost;
  player.materials[requiredMaterial] -= 1;
  eq.durability = 100;
  
  calculatePlayerStats(player); // Recalculate in case it was 0% and now gives stats again

  saveMinigameDB(db);
  
  return `🛠️ *CLINK CLANK CLINK!* **${eq.name}** berhasil diperbaiki 100% mulus! (Biaya: ${cost} Coin & 1 ${requiredMaterial})`;
}

export function handleForge(db: MinigameDB, player: PlayerInventory, itemName: string): string {
  // Find in equipment
  let foundSlot: SlotName | null = null;
  for (const slot of SLOT_NAMES) {
    const eq = player.equipment[slot] as EquipmentSlot;
    if (eq.name && eq.name.toLowerCase() === itemName.toLowerCase()) {
      foundSlot = slot;
      break;
    }
  }
  
  if (!foundSlot) return 'Barang "' + itemName + '" tidak sedang kamu pakai! Pakai dulu (`!equip`) baru di-forge.';
  
  const eq = player.equipment[foundSlot] as EquipmentSlot;
  const currentLvl = eq.level || 0;
  
  if (currentLvl >= 10) return `Barang **${eq.name}** sudah mencapai level maksimal (+10)!`;
  
  const costGems = (currentLvl + 1) * 200;
  let costWls = (currentLvl + 1) * 10;
  if (player.town?.research?.unlockedTechs?.includes('metallurgy') || player.town?.research?.metallurgy) {
    costWls = Math.max(1, Math.floor(costWls * 0.8)); // 20% discount
  }
  
  let requiredMaterial = 'Wood';
  const n = eq.name?.toLowerCase() || '';
  if (n.includes('iron') || n.includes('sword') || n.includes('armor')) requiredMaterial = 'Iron Ore';
  if (n.includes('magic') || n.includes('staff') || n.includes('robe')) requiredMaterial = 'Magic Dust';
  if (n.includes('dragon') || n.includes('excalibur')) requiredMaterial = 'Dragon Scale';
  
  const matCost = currentLvl + 1;
  const matCount = player.materials?.[requiredMaterial] || 0;
  
  if (player.gems < costGems || player.coins < costWls || matCount < matCost) {
    return `Kurang modal! Biaya Forge ke +${currentLvl + 1}:\n💎 ${costGems} Gems (Punya ${player.gems})\n🔒 ${costWls} Coin (Punya ${player.coins})\n🔨 ${matCost}x ${requiredMaterial} (Punya ${matCount})`;
  }
  
  // Deduct costs
  player.gems -= costGems;
  player.coins -= costWls;
  player.materials![requiredMaterial] -= matCost;
  
  const successChance = Math.max(10, 90 - (currentLvl * 10)); // +1 = 90%, +2 = 80%, ..., +9 = 10%
  const roll = Math.floor(Math.random() * 100);
  
  let msg = `🛠️ Kamu mencoba menimpa **${eq.name}** dari +${currentLvl} ke +${currentLvl + 1}...\n`;
  
  if (roll < successChance) {
    eq.level = currentLvl + 1;
    msg += `✨ **BERHASIL!** Senjatamu bersinar terang dan naik menjadi **+${eq.level}**! (+10% Stats per level)`;
  } else {
    // Fail
    if (currentLvl >= 5) {
      eq.level = Math.max(0, currentLvl - 1);
      eq.durability = Math.max(0, eq.durability - 50);
      msg += `💥 **GAGAL TOTAL!** Asap mengepul! Karena level sudah tinggi, senjatamu turun ke **+${eq.level}** dan kehilangan 50 Durability!`;
    } else {
      eq.durability = Math.max(0, eq.durability - 20);
      msg += `❌ **GAGAL!** Percikan api menyambar, tapi prosesnya gagal. Senjata tidak naik level dan kehilangan 20 Durability.`;
    }
  }
  
  calculatePlayerStats(player);
  saveMinigameDB(db);
  return msg;
}

export function degradeEquipmentDurability(player: PlayerInventory, amount: number = 5) {
  for (const slot of SLOT_NAMES) {
    const eq = player.equipment[slot] as EquipmentSlot;
    if (eq.name && eq.durability > 0) {
      eq.durability -= amount;
      if (eq.durability < 0) eq.durability = 0;
    }
  }
}
