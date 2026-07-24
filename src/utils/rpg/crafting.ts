import { EmbedBuilder } from 'discord.js';
import { PlayerInventory, MinigameDB, saveMinigameDB, getPlayer } from '../minigame';
import { COLORS, fmt } from './ui';

export interface Recipe {
  id: string;
  name: string;
  type: string;
  materials: Record<string, number>;
  baseAtk?: number;
  baseHp?: number;
  desc: string;
}

export const RECIPES: Record<string, Recipe> = {
  'iron sword': {
    id: 'iron sword',
    name: 'Iron Sword',
    type: 'weapon',
    materials: { 'Iron Ore': 10, 'Wood': 2 },
    baseAtk: 15,
    baseHp: 50,
    desc: 'Pedang besi standar hasil tempaan.'
  },
  'dragon armor': {
    id: 'dragon armor',
    name: 'Dragon Armor',
    type: 'armor',
    materials: { 'Dragon Scale': 5, 'Iron Ore': 5 },
    baseAtk: 5,
    baseHp: 300,
    desc: 'Armor dari sisik naga yang sangat keras.'
  },
  'magic staff': {
    id: 'magic staff',
    name: 'Magic Staff',
    type: 'weapon',
    materials: { 'Magic Dust': 10, 'Wood': 5 },
    baseAtk: 25,
    baseHp: 20,
    desc: 'Tongkat sihir yang dipenuhi energi mistis.'
  },
  'emerald ring': {
    id: 'emerald ring',
    name: 'Emerald Ring',
    type: 'ring',
    materials: { 'Magic Dust': 5, 'Iron Ore': 2 },
    baseAtk: 10,
    baseHp: 100,
    desc: 'Cincin zamrud bercahaya.'
  }
};

const CRAFT_PREFIX = ['Flaming', 'Frozen', 'Cursed', 'Blessed', 'Heavy', 'Swift', 'Divine'];

export function handleCrafting(db: MinigameDB, player: PlayerInventory, args: string[], userId: string): { embeds: EmbedBuilder[] } {
  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🔨 Blacksmith Crafting')
      .setDescription('Gunakan `!craft <nama_resep>` untuk membuat equipment.\n\n**Daftar Resep:**');
      
    for (const [id, recipe] of Object.entries(RECIPES)) {
      let matsStr = Object.entries(recipe.materials).map(([m, c]) => `${c} ${m}`).join(', ');
      embed.addFields({ name: `🗡️ ${recipe.name}`, value: `Bahan: ${matsStr}\nStats: ATK+${recipe.baseAtk || 0} HP+${recipe.baseHp || 0}`, inline: false });
    }
    
    // Tampilkan material pemain
    let invMats = '';
    if (player.materials && Object.keys(player.materials).length > 0) {
      invMats = Object.entries(player.materials).map(([m, c]) => `**${m}**: ${c}`).join('\n');
    } else {
      invMats = '*Kamu tidak punya material apa-apa.*';
    }
    embed.addFields({ name: '🎒 Materialmu', value: invMats, inline: false });
    
    return { embeds: [embed] };
  }

  const recipeId = args.join(' ').toLowerCase();
  const recipe = RECIPES[recipeId];
  
  if (!recipe) {
    return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Resep **${recipeId}** tidak ditemukan. Cek \`!craft\` untuk daftar resep.`)] };
  }

  // Cek bahan
  if (!player.materials) player.materials = {};
  for (const [mat, count] of Object.entries(recipe.materials)) {
    if ((player.materials[mat] || 0) < count) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Bahan tidak cukup untuk membuat **${recipe.name}**!\nKamu butuh **${count} ${mat}** tapi hanya punya **${player.materials[mat] || 0}**.`)] };
    }
  }

  // Potong bahan
  for (const [mat, count] of Object.entries(recipe.materials)) {
    player.materials[mat] -= count;
    if (player.materials[mat] <= 0) delete player.materials[mat];
  }

  // Bikin item dengan random stats bonus (+0 to +15) dan prefix acak
  const bonusAtk = Math.floor(Math.random() * 16);
  const bonusHp = Math.floor(Math.random() * 51);
  const prefix = CRAFT_PREFIX[Math.floor(Math.random() * CRAFT_PREFIX.length)];
  
  const finalName = `${prefix} ${recipe.name}`;
  
  player.items.push(finalName);
  
  saveMinigameDB(db);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🔨 Crafting Berhasil!')
    .setDescription(`Kamu berhasil membuat **${finalName}**!`)
    .addFields(
      { name: 'Stats Bawaan', value: `ATK+${recipe.baseAtk || 0}\nHP+${recipe.baseHp || 0}`, inline: true },
      { name: 'Bonus Tempa', value: `ATK+${bonusAtk}\nHP+${bonusHp}`, inline: true }
    )
    .setFooter({ text: 'Gunakan !inv untuk melihat equipment barumu.' });

  return { embeds: [embed] };
}
