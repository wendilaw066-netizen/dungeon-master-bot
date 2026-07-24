const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/equipment.ts', 'utf8');

const targetFunction = `export function degradeEquipmentDurability(player: PlayerInventory, amount: number = 5) {`;
const newFunction = `export function handleForge(db: MinigameDB, player: PlayerInventory, itemName: string): string {
  // Find in equipment
  let foundSlot: SlotName | null = null;
  for (const slot of SLOT_NAMES) {
    const eq = player.equipment[slot] as EquipmentSlot;
    if (eq.name && eq.name.toLowerCase() === itemName.toLowerCase()) {
      foundSlot = slot;
      break;
    }
  }
  
  if (!foundSlot) return \`Barang "\${itemName}" tidak sedang kamu pakai! Pakai dulu (\`!equip\`) baru di-forge.\`;
  
  const eq = player.equipment[foundSlot] as EquipmentSlot;
  const currentLvl = eq.level || 0;
  
  if (currentLvl >= 10) return \`Barang **\${eq.name}** sudah mencapai level maksimal (+10)!\`;
  
  const costGems = (currentLvl + 1) * 200;
  const costWls = (currentLvl + 1) * 10;
  
  let requiredMaterial = 'Wood';
  const n = eq.name?.toLowerCase() || '';
  if (n.includes('iron') || n.includes('sword') || n.includes('armor')) requiredMaterial = 'Iron Ore';
  if (n.includes('magic') || n.includes('staff') || n.includes('robe')) requiredMaterial = 'Magic Dust';
  if (n.includes('dragon') || n.includes('excalibur')) requiredMaterial = 'Dragon Scale';
  
  const matCost = currentLvl + 1;
  const matCount = player.materials?.[requiredMaterial] || 0;
  
  if (player.gems < costGems || player.wls < costWls || matCount < matCost) {
    return \`Kurang modal! Biaya Forge ke +\${currentLvl + 1}:\\n💎 \${costGems} Gems (Punya \${player.gems})\\n🔒 \${costWls} WL (Punya \${player.wls})\\n🔨 \${matCost}x \${requiredMaterial} (Punya \${matCount})\`;
  }
  
  // Deduct costs
  player.gems -= costGems;
  player.wls -= costWls;
  player.materials![requiredMaterial] -= matCost;
  
  const successChance = Math.max(10, 90 - (currentLvl * 10)); // +1 = 90%, +2 = 80%, ..., +9 = 10%
  const roll = Math.floor(Math.random() * 100);
  
  let msg = \`🛠️ Kamu mencoba menimpa **\${eq.name}** dari +\${currentLvl} ke +\${currentLvl + 1}...\\n\`;
  
  if (roll < successChance) {
    eq.level = currentLvl + 1;
    msg += \`✨ **BERHASIL!** Senjatamu bersinar terang dan naik menjadi **+\${eq.level}**! (+10% Stats per level)\`;
  } else {
    // Fail
    if (currentLvl >= 5) {
      eq.level = Math.max(0, currentLvl - 1);
      eq.durability = Math.max(0, eq.durability - 50);
      msg += \`💥 **GAGAL TOTAL!** Asap mengepul! Karena level sudah tinggi, senjatamu turun ke **+\${eq.level}** dan kehilangan 50 Durability!\`;
    } else {
      eq.durability = Math.max(0, eq.durability - 20);
      msg += \`❌ **GAGAL!** Percikan api menyambar, tapi prosesnya gagal. Senjata tidak naik level dan kehilangan 20 Durability.\`;
    }
  }
  
  calculatePlayerStats(player);
  saveMinigameDB(db);
  return msg;
}

export function degradeEquipmentDurability(player: PlayerInventory, amount: number = 5) {`;

code = code.replace(targetFunction, newFunction);

fs.writeFileSync('src/utils/rpg/equipment.ts', code, 'utf8');
console.log('Added handleForge to equipment.ts');
