import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, MinigameDB } from '../minigame';

function random(seed: number) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function getTileType(x: number, y: number): 'plains' | 'forest' | 'mountain' | 'water' {
  const seed = (x * 73856093) ^ (y * 19349663);
  const r = random(seed);
  if (r < 0.15) return 'mountain';
  if (r < 0.35) return 'forest';
  if (r < 0.50) return 'water';
  return 'plains';
}

export const TILE_EMOJIS = {
  plains: '🟩',
  forest: '🌲',
  mountain: '⛰️',
  water: '🌊',
  player: '🏰',
  enemy: '🏕️'
};

import { AttachmentBuilder } from 'discord.js';
import { generateMapImage, generateFullMapImage } from './mapRenderer';

export async function renderMapMenu(player: PlayerInventory, userName: string, db: MinigameDB, viewX: number, viewY: number) {
  const town = player.town;
  if (!town) return 'Town not found.';
  
  if (!town.location) {
    // Spawn town safely away from exact center
    town.location = { 
      x: Math.floor(Math.random() * 100) - 50, 
      y: Math.floor(Math.random() * 100) - 50 
    };
  }
  
  const px = town.location.x;
  const py = town.location.y;
  
  // Find other players
  const otherPlayers = Object.entries(db)
    .filter(([id, p]) => p.town?.location && id !== 'GLOBAL_STATE')
    .map(([id, p]) => p);
  
  // Generate canvas image
  const buffer = await generateMapImage(viewX, viewY, px, py, otherPlayers);
  const attachment = new AttachmentBuilder(buffer, { name: 'world_map.png' });
  
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🗺️ World Map — View (${viewX}, ${viewY})`)
    .setDescription(
      `Welcome to the world, Governor **${userName}**.\n` +
      `Your City Location: **(${px}, ${py})**`
    )
    .setImage('attachment://world_map.png')
    .setFooter({ text: 'Use buttons to pan the map.' });
    
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`town_map_pan_${viewX}_${viewY-1}`).setEmoji('⬆️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`town_map_pan_${viewX}_${viewY+1}`).setEmoji('⬇️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`town_map_pan_${viewX-1}_${viewY}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`town_map_pan_${viewX+1}_${viewY}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`town_map_center`).setLabel('My City').setStyle(ButtonStyle.Primary)
  );
  
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`town_march_menu`).setLabel('Send Army (March)').setEmoji('⚔️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`town_main`).setLabel('Back to City').setStyle(ButtonStyle.Danger)
  );
  
  return { embeds: [embed], components: [row1, row2], files: [attachment] };
}

export async function renderFullMapMenu(player: PlayerInventory, userName: string, db: MinigameDB) {
  // Find other players
  const otherPlayers = Object.entries(db)
    .filter(([id, p]) => p.town?.location && id !== 'GLOBAL_STATE')
    .map(([id, p]) => p);
  
  const disasters = db['GLOBAL_STATE']?.worldDisasters || [];
  const buffer = await generateFullMapImage(otherPlayers, player, disasters);
  const attachment = new AttachmentBuilder(buffer, { name: 'full_world_map.png' });
  
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🌍 Full World Map`)
    .setDescription(`A global view of the entire 100x100 continent.\nYour town is marked with a 🟨 **Gold square**.\nOther towns are colored by their Faction (🟩 Shu, 🟦 Wei, 🟥 Wu).`)
    .setImage('attachment://full_world_map.png');
    
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`dash_refresh`).setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary)
  );
  
  return { embeds: [embed], components: [row], files: [attachment] };
}
