import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB, MinigameDB } from '../minigame';
import { pushDashboardLog } from './dashboard';
import { getGeneralBuff } from './generals';
import { getTileType } from './map';

export function calculateDistance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function renderMarchMenu(player: PlayerInventory, userName: string, db: MinigameDB) {
  const town = player.town;
  if (!town) return 'Town not found.';
  
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle(`${EMOJIS.unit_infantry} War Room / Army March — ${userName}`)
    .setDescription(
      `Send your army across the world map. Marching takes time based on distance (5 minutes per coordinate).\n\n` +
      `**Current Location:** (${town.location?.x || 0}, ${town.location?.y || 0})\n` +
      `**Available Troops:**\n` +
      `${EMOJIS.btn_shield} Infantry: ${town.army?.infantry || 0}\n` +
      `🏹 Archers: ${town.army?.archers || 0}\n` +
      `🐎 Cavalry: ${town.army?.cavalry || 0}\n` +
      `🗡️ Spearmen: ${town.army?.spearmen || 0}\n` +
      `${EMOJIS.res_stone} Catapults: ${town.army?.catapults || 0}\n`
    );
    
  if (town.marches && town.marches.length > 0) {
    let marchStr = '';
    for (const m of town.marches) {
      if (m.status === 'marching') {
        const remainingStr = Math.max(0, Math.floor((m.arrivalMs - Date.now()) / 60000));
        marchStr += `• 🏃 Marching to (${m.targetX}, ${m.targetY}) - Arrives in **${remainingStr} mins**\n`;
      } else if (m.status === 'returning') {
        const remainingStr = Math.max(0, Math.floor((m.arrivalMs - Date.now()) / 60000));
        marchStr += `• 🔙 Returning from (${m.targetX}, ${m.targetY}) - Arrives in **${remainingStr} mins**\n`;
      }
    }
    if (marchStr) embed.addFields({ name: 'Active Marches', value: marchStr });
  }

  // To target a coordinate, we'll provide some quick targets or they can use a discord slash command
  // Since we can't easily pop up a modal from a string customId via direct handler without interaction context,
  // we will just list a few targets: "Attack Nearest Rebel", "Conquer Nearest Tile"
  
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('march_rebel').setLabel('March vs Rebels (PvE)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('march_conquer').setLabel('Conquer Nearest Resource').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('march_capital').setLabel('Siege Nearest Capital').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('town_map').setLabel('Back to Map').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1] };
}

export function handleMarchAction(player: PlayerInventory, action: string, db: MinigameDB) {
  const town = player.town;
  if (!town || !town.location) return 'No town location found.';
  
  if (!town.marches) town.marches = [];
  
  // Basic sanity check: prevent multiple marches if no multiple army mechanics yet
  if (town.marches.filter(m => m.status !== 'completed').length >= 1) {
    return '❌ You already have an active march. Wait for them to return!';
  }
  
  const totalTroops = (town.army?.infantry || 0) + (town.army?.archers || 0) + (town.army?.cavalry || 0) + (town.army?.spearmen || 0) + (town.army?.catapults || 0);
  if (totalTroops < 1) return '❌ You have no troops to send on a march!';

  let targetX = town.location.x;
  let targetY = town.location.y;
  let type: 'attack_rebel' | 'conquer_tile' | 'attack_capital' = 'attack_rebel';
  
  if (action === 'march_rebel') {
    targetX += (Math.floor(Math.random() * 5) - 2);
    targetY += (Math.floor(Math.random() * 5) - 2);
    type = 'attack_rebel';
  } else if (action === 'march_conquer') {
    targetX += (Math.floor(Math.random() * 3) - 1);
    targetY += (Math.floor(Math.random() * 3) - 1);
    type = 'conquer_tile';
  } else if (action === 'march_capital') {
    const { loadWorldDB } = require('./world');
    const worldDB = loadWorldDB();
    let minCapDist = 9999;
    for (const r of Object.values(worldDB.regions) as any) {
       if (r.id.startsWith('cap')) {
          const capDist = calculateDistance(town.location.x, town.location.y, r.x, r.y);
          if (capDist < minCapDist) {
             minCapDist = capDist;
             targetX = r.x;
             targetY = r.y;
          }
       }
    }
    type = 'attack_capital';
  }
  
  // ensure target is not same as current
  if (targetX === town.location.x && targetY === town.location.y) targetX += 1;
  
  const dist = calculateDistance(town.location.x, town.location.y, targetX, targetY);
  // Base time: 5 minutes per unit of distance.
  const timeMins = Math.max(1, Math.floor(dist * 5));
  
  const marchId = 'M_' + Date.now();
  town.marches.push({
    id: marchId,
    targetId: null,
    targetX,
    targetY,
    startMs: Date.now(),
    arrivalMs: Date.now() + (timeMins * 60000),
    army: {
      infantry: town.army?.infantry || 0,
      archers: town.army?.archers || 0,
      cavalry: town.army?.cavalry || 0,
      spearmen: town.army?.spearmen || 0,
      catapults: town.army?.catapults || 0
    },
    type,
    status: 'marching'
  });
  
  // Deduct troops from town defense while marching
  town.army!.infantry = 0;
  town.army!.archers = 0;
  town.army!.cavalry = 0;
  town.army!.spearmen = 0;
  town.army!.catapults = 0;
  
  saveMinigameDB(db);
  
  return `✅ **Army dispatched!** Marching to (${targetX}, ${targetY}). Distance: ${dist.toFixed(1)}.\nEstimated time: **${timeMins} minutes**.`;
}

// Tick processing for arrived marches
export function processMarches(db: MinigameDB, player: PlayerInventory) {
  const town = player.town;
  if (!town || !town.marches || town.marches.length === 0) return;

  
  let changed = false;
  const now = Date.now();
  
  for (const m of town.marches) {
    if (m.status === 'marching' && now >= m.arrivalMs) {
      // Arrived at destination! Execute logic.
      if (m.type === 'attack_rebel') {
        const wlGained = Math.floor(Math.random() * 200) + 50;
        player.coins += wlGained;
        
        let lost = 0;
        if (m.army.infantry > 0 && Math.random() < 0.3) { m.army.infantry--; lost++; }
        
        pushDashboardLog(player, `${EMOJIS.unit_infantry} **March Arrived!** Your army defeated rebels at (${m.targetX}, ${m.targetY})! Looted **${wlGained} Coin**. Lost ${lost} troops.`);
      } else if (m.type === 'conquer_tile') {
        const tileType = getTileType(m.targetX, m.targetY);
        if (!town.conqueredTiles) town.conqueredTiles = [];
        
        const existing = town.conqueredTiles.find((t: any) => t.x === m.targetX && t.y === m.targetY);
        if (!existing) {
          town.conqueredTiles.push({ x: m.targetX, y: m.targetY, type: tileType });
          pushDashboardLog(player, `${EMOJIS.btn_shield} **March Arrived!** Your army successfully occupied a ${tileType} tile at (${m.targetX}, ${m.targetY})!`);
        } else {
          pushDashboardLog(player, `${EMOJIS.btn_shield} **March Arrived!** The tile at (${m.targetX}, ${m.targetY}) was already occupied.`);
        }
      } else if (m.type === 'attack_player') {
        const { resolveArmyMarch } = require('./town');
        resolveArmyMarch(db, player, m, null);
      } else if (m.type === 'attack_capital') {
        const { loadWorldDB, saveWorldDB } = require('./world');
        const worldDB = loadWorldDB();
        const cap = Object.values(worldDB.regions).find((r: any) => r.x === m.targetX && r.y === m.targetY) as any;
        if (cap) {
           // Basic siege logic
           const armyPower = m.army.infantry + m.army.cavalry * 2 + m.army.archers * 1.5 + (m.army.catapults || 0) * 5;
           if (armyPower > cap.defenders) {
              cap.defenders = 0;
              cap.controller = player.faction || 'Rebels';
              pushDashboardLog(player, `🚩 **SIEGE SUCCESS!** Your army captured the Provincial Capital of **${cap.name}** for your faction!`);
              saveWorldDB(worldDB);
           } else {
              cap.defenders -= Math.floor(armyPower * 0.5); // Damage defenders
              m.army.infantry = 0; m.army.cavalry = 0; m.army.archers = 0; m.army.catapults = 0; // Wipe attacking army
              pushDashboardLog(player, `💀 **SIEGE DEFEAT!** Your army was wiped out attacking the Provincial Capital of **${cap.name}**!`);
              saveWorldDB(worldDB);
           }
        }
      }
      
      // Send them back
      m.status = 'returning';
      const dist = calculateDistance(town.location!.x, town.location!.y, m.targetX, m.targetY);
      const timeMins = Math.max(1, Math.floor(dist * 5));
      m.arrivalMs = now + (timeMins * 60000);
      changed = true;
      
    } else if (m.status === 'returning' && now >= m.arrivalMs) {
      // Arrived back home
      m.status = 'completed';
      
      if (!town.army) town.army = { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0, factionUnits: 0, mercenaries: 0 };
      town.army.infantry += m.army.infantry;
      town.army.archers += m.army.archers;
      town.army.cavalry += m.army.cavalry;
      town.army.spearmen = (town.army.spearmen || 0) + m.army.spearmen;
      town.army.catapults = (town.army.catapults || 0) + m.army.catapults;
      town.army.mercenaries = (town.army.mercenaries || 0) + (m.army.mercenaries || 0);
      town.army.factionUnits = (town.army.factionUnits || 0) + (m.army.factionUnits || 0);
      
      pushDashboardLog(player, `🏰 **Army Returned!** Your troops have safely returned to the city from (${m.targetX}, ${m.targetY}).`);
      changed = true;
    }
  }
  
  // Clean up completed marches
  if (changed) {
    town.marches = town.marches.filter(m => m.status !== 'completed');
  }
}
