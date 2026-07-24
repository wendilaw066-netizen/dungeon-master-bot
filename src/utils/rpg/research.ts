import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB, MinigameDB } from '../minigame';
import { getGeneralBuff } from './generals';

export interface TechNode {
  id: string;
  name: string;
  description: string;
  costWL: number;
  durationMs: number;
  prerequisites: string[];
}

export const TECH_TREE: TechNode[] = [
  {
    id: 'advancedFarming',
    name: '🌾 Crop Rotation',
    description: '+20% Farm passive yield and faster animal breeding.',
    costWL: 50,
    durationMs: 2 * 60 * 60 * 1000, // 2 hours
    prerequisites: []
  },
  {
    id: 'metallurgy',
    name: '⚒️ Advanced Metallurgy',
    description: 'Reduces weapon crafting cost in Blacksmith.',
    costWL: 80,
    durationMs: 4 * 60 * 60 * 1000, // 4 hours
    prerequisites: []
  },
  {
    id: 'heavyInfantry',
    name: '🛡️ Elite Tactics',
    description: '+10% attack power for Infantry during raids.',
    costWL: 100,
    durationMs: 6 * 60 * 60 * 1000,
    prerequisites: ['metallurgy']
  },
  {
    id: 'medicine',
    name: '🌿 Herbal Medicine',
    description: 'Increases Hospital healing rate and reduces plague chance.',
    costWL: 60,
    durationMs: 3 * 60 * 60 * 1000,
    prerequisites: ['advancedFarming']
  },
  {
    id: 'gunpowder',
    name: '💣 Gunpowder (Mesiu)',
    description: 'Enables construction of Catapults and Siege Weaponry.',
    costWL: 200,
    durationMs: 12 * 60 * 60 * 1000, // 12 hours
    prerequisites: ['metallurgy']
  }
];

// Helper to get research status
export function checkResearchStatus(player: PlayerInventory) {
  if (!player.town || !player.town.research || !player.town.research.activeId) return;
  const { activeId, endTimestamp } = player.town.research;
  
  if (Date.now() >= (endTimestamp || 0)) {
    // Research completed!
    if (!player.town.research.unlockedTechs) player.town.research.unlockedTechs = [];
    if (!player.town.research.unlockedTechs.includes(activeId)) {
      player.town.research.unlockedTechs.push(activeId);
      
      // Backward compatibility flags
      if (activeId === 'advancedFarming') player.town.research.advancedFarming = true;
      if (activeId === 'metallurgy') player.town.research.metallurgy = true;
    }
    
    player.town.research.activeId = null;
    player.town.research.endTimestamp = 0;
  }
}

// Render menu
export function renderAcademyMenu(player: PlayerInventory, userName: string, db: MinigameDB) {
  checkResearchStatus(player); // update any finished research before rendering
  const research = player.town?.research;
  if (!research) return { embeds: [new EmbedBuilder().setDescription('No town found.')], components: [] };
  
  const unlocked = research.unlockedTechs || [];
  const activeId = research.activeId;
  const endTs = research.endTimestamp || 0;
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎓 Town Academy & Research Center')
    .setDescription('Invest World Locks and time to discover new technologies that will permanently boost your empire.');
    
  if (activeId) {
    const activeTech = TECH_TREE.find(t => t.id === activeId);
    const timeLeftMs = endTs - Date.now();
    const hrs = Math.floor(timeLeftMs / 3600000);
    const mins = Math.floor((timeLeftMs % 3600000) / 60000);
    embed.addFields({
      name: '🔬 Active Research',
      value: `**${activeTech?.name || activeId}** is currently being researched.\n⏳ Time remaining: **${hrs}h ${mins}m**`,
      inline: false
    });
  } else {
    embed.addFields({
      name: '🔬 Active Research',
      value: '*Academy scholars are idle. Select a technology to research.*',
      inline: false
    });
  }
  
  let techDesc = '';
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  
  TECH_TREE.forEach((tech) => {
    const isUnlocked = unlocked.includes(tech.id);
    const canAfford = player.coins >= tech.costWL;
    const prereqsMet = tech.prerequisites.every(p => unlocked.includes(p));
    
    let statusIcon = '❌';
    if (isUnlocked) statusIcon = '✅';
    else if (activeId === tech.id) statusIcon = '🔬';
    else if (!prereqsMet) statusIcon = '🔒';
    else if (canAfford) statusIcon = '🟢';
    else statusIcon = '💰'; // Need Coin
    
    const buff = getGeneralBuff(player, 'research_spd');
    const actualDuration = Math.floor(tech.durationMs * (1 - buff));
    techDesc += `${statusIcon} **${tech.name}**\n> *${tech.description}*\n> Cost: **${tech.costWL} Coin** | Duration: **${actualDuration / 3600000} Hours**\n\n`;
    
    // Create button if not unlocked and prereqs met
    if (!isUnlocked && prereqsMet && !activeId) {
      const btn = new ButtonBuilder()
        .setCustomId(`town_research_${tech.id}`)
        .setLabel(tech.name.replace(/[^a-zA-Z ]/g, '').trim())
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canAfford);
        
      if (row.components.length >= 4) {
        rows.push(row);
        row = new ActionRowBuilder<ButtonBuilder>();
      }
      row.addComponents(btn);
    }
  });
  
  if (row.components.length > 0) rows.push(row);
  
  // Add Back Button
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('town_menu_upgrading').setLabel('Back to Upgrades').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
  );
  rows.push(backRow);
  
  embed.addFields({
    name: '📜 Technology Tree',
    value: techDesc || '*No technologies available.*',
    inline: false
  });
  
  const { getCashflowField } = require('./town');
  embed.addFields(getCashflowField(player));

  return { embeds: [embed], components: rows };
}

export function handleResearchAction(player: PlayerInventory, action: string, db: MinigameDB): string {
  const techId = action.replace('research_', '');
  const tech = TECH_TREE.find(t => t.id === techId);
  
  if (!tech) return '❌ Technology not found!';
  if (player.town?.research?.activeId) return '❌ You are already researching something!';
  if (player.coins < tech.costWL) return `❌ You need **${tech.costWL} Coin** to research this.`;
  if (!player.town?.research) return '❌ No research facility found.';
  
  const buff = getGeneralBuff(player, 'research_spd');
  const actualDuration = Math.floor(tech.durationMs * (1 - buff));

  player.coins -= tech.costWL;
  player.town.research.activeId = tech.id;
  player.town.research.endTimestamp = Date.now() + actualDuration;
  
  saveMinigameDB(db);
  return `🔬 You have started researching **${tech.name}**! It will be completed in **${actualDuration / 3600000} Hours** (Buffed by General).`;
}
