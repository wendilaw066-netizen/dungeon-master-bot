const fs = require('fs');

let f = fs.readFileSync('src/utils/rpg/equipment.ts', 'utf8');

const oldLoad = `function loadCatalogSafe() {
  if (_catalogCache) return _catalogCache;
  try {
    const W = require('./weapons') as any;
    const allDrops = Object.values(W.DUNGEON_DROPS as Record<number, any[]>).flat();
    const gacha    = (W.GACHA_POOL as Array<{ weapon: any }>).map(e => e.weapon);
    _catalogCache  = [...(W.SHOP_WEAPONS as any[]), ...allDrops, ...gacha];
  } catch { _catalogCache = []; }
  return _catalogCache!;
}`;

const newLoad = `function loadCatalogSafe() {
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
}`;

f = f.replace(oldLoad, newLoad);

const oldInfer = `export function inferSlotFromName(itemName: string): SlotName | null {
  const name = itemName.toLowerCase();
  if (name.includes('sword') || name.includes('blade') || name.includes('katana') || name.includes('bow') || name.includes('gun') || name.includes('fist')) return 'weapon';
  if (name.includes('shield')) return 'shield';
  if (name.includes('helmet') || name.includes('cap') || name.includes('hood')) return 'helmet';
  if (name.includes('armor') || name.includes('chest') || name.includes('robe') || name.includes('suit')) return 'armor';
  if (name.includes('glove') || name.includes('gauntlet')) return 'gloves';
  if (name.includes('boot') || name.includes('shoe')) return 'boots';
  if (name.includes('necklace') || name.includes('amulet')) return 'necklace';
  if (name.includes('earring')) return 'earrings';
  if (name.includes('ring') || name.includes('band')) return 'ring';
  if (name.includes('pet') || name.includes('dragon') || name.includes('wolf')) return 'pet';
  if (name.includes('artifact') || name.includes('rune') || name.includes('crystal')) return 'artifact';
  return null;
}`;

const newInfer = `export function inferSlotFromName(itemName: string): SlotName | null {
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
}`;

f = f.replace(oldInfer, newInfer);

fs.writeFileSync('src/utils/rpg/equipment.ts', f);
