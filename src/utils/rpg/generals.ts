import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB, MinigameDB } from '../minigame';
import { FACTIONS } from './factions';

export interface General {
  id: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  faction: string;
  buffDesc: string;
  buffType: 'infantry_atk' | 'farm_yield' | 'cavalry_atk' | 'research_spd';
  buffValue: number; // percentage (e.g. 0.2 for 20%)
  role: 'Tank' | 'Healer' | 'DPS'; // For Dungeon Combat
}

export const GENERALS_DB: General[] = [
  { id: 'lubu', name: 'Lu Bu', rarity: 'Legendary', faction: 'Dong Zhuo', buffType: 'cavalry_atk', buffValue: 0.5, buffDesc: '+50% Cavalry Attack', role: 'DPS' },
  { id: 'guanyu', name: 'Guan Yu', rarity: 'Legendary', faction: 'Shu', buffType: 'infantry_atk', buffValue: 0.4, buffDesc: '+40% Infantry Attack', role: 'DPS' },
  { id: 'caocao', name: 'Cao Cao', rarity: 'Epic', faction: 'Wei', buffType: 'research_spd', buffValue: 0.3, buffDesc: '+30% Faster Research', role: 'Tank' },
  { id: 'zhugeliang', name: 'Zhuge Liang', rarity: 'Legendary', faction: 'Shu', buffType: 'research_spd', buffValue: 0.5, buffDesc: '+50% Faster Research', role: 'Healer' },
  { id: 'zhaoyun', name: 'Zhao Yun', rarity: 'Epic', faction: 'Shu', buffType: 'cavalry_atk', buffValue: 0.3, buffDesc: '+30% Cavalry Attack', role: 'DPS' },
  { id: 'xiahoudun', name: 'Xiahou Dun', rarity: 'Epic', faction: 'Wei', buffType: 'infantry_atk', buffValue: 0.3, buffDesc: '+30% Infantry Attack', role: 'Tank' },
  { id: 'sunjian', name: 'Sun Jian', rarity: 'Rare', faction: 'Wu', buffType: 'farm_yield', buffValue: 0.2, buffDesc: '+20% Farm Yield', role: 'Tank' },
  { id: 'zhouyu', name: 'Zhou Yu', rarity: 'Epic', faction: 'Wu', buffType: 'farm_yield', buffValue: 0.4, buffDesc: '+40% Farm Yield', role: 'Healer' },
  { id: 'liubei', name: 'Liu Bei', rarity: 'Rare', faction: 'Shu', buffType: 'farm_yield', buffValue: 0.3, buffDesc: '+30% Farm Yield', role: 'Healer' }
];

export function getGachaCost(generalsCount: number): number {
  if (generalsCount === 0) return 50;
  if (generalsCount === 1) return 250;
  return 1000;
}

export function renderGeneralsMenu(player: PlayerInventory, userName: string, db: MinigameDB) {
  const town = player.town!;
  const myGenerals = town.generals || [];
  const active = town.activeGeneral;
  
  const gachaCost = getGachaCost(myGenerals.length);
  
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`🦸 Generals Pavilion — ${userName}`)
    .setDescription(
      `Recruit legendary heroes to govern your city or lead your armies into battle! Generals provide massive passive buffs.\n\n` +
      `**Gacha Cost:** \`${gachaCost} Coin\` per roll.`
    );
    
  const activeParty = town.activeParty || [];
  
  if (activeParty.length > 0) {
    let partyStr = '';
    activeParty.forEach((gId, idx) => {
      const g = GENERALS_DB.find(x => x.id === gId);
      partyStr += `**${idx+1}. ${g?.name}** (${g?.role})\n> *${g?.buffDesc}*\n`;
    });
    embed.addFields({
      name: '👑 Active Dungeon Party',
      value: partyStr,
      inline: false
    });
  } else {
    embed.addFields({
      name: '👑 Active Dungeon Party',
      value: `*No generals have been assigned to your party.*`,
      inline: false
    });
  }
  
  let rosterStr = '';
  if (myGenerals.length === 0) {
    rosterStr = '*You have not recruited any generals yet.*';
  } else {
    // group by count if duplicate
    const counts: Record<string, number> = {};
    for (const id of myGenerals) counts[id] = (counts[id] || 0) + 1;
    
    for (const [id, count] of Object.entries(counts)) {
      const g = GENERALS_DB.find(x => x.id === id);
      if (g) {
        rosterStr += `• **${g.name}** (${g.rarity}) ${count > 1 ? `x${count}` : ''} - *${g.buffDesc}*\n`;
      }
    }
  }
  
  embed.addFields({ name: '📜 Your Roster', value: rosterStr, inline: false });
  
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('town_gacha_general').setLabel(`Recruit (${gachaCost} Coin)`).setEmoji('🎲').setStyle(ButtonStyle.Success).setDisabled((player.town?.tier || 1) < 4)
  );
  if ((player.town?.tier || 1) < 4) {
    embed.addFields({ name: '⚠️ Restricted', value: 'You must upgrade your Town to **Tier 4** before you can recruit Generals!', inline: false });
  }
  rows.push(row1);
  
  // Create equip/unequip buttons for unique generals
  const uniqueGenIds = Array.from(new Set(myGenerals));
  if (uniqueGenIds.length > 0) {
    let equipRow = new ActionRowBuilder<ButtonBuilder>();
    let btnCount = 0;
    for (let i = 0; i < uniqueGenIds.length && btnCount < 4; i++) {
      const g = GENERALS_DB.find(x => x.id === uniqueGenIds[i]);
      if (g) {
        const inParty = activeParty.includes(g.id);
        equipRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`town_equip_general_${g.id}`)
            .setLabel(inParty ? `Remove ${g.name}` : `Add ${g.name}`)
            .setStyle(inParty ? ButtonStyle.Danger : ButtonStyle.Primary)
        );
        btnCount++;
      }
    }
    rows.push(equipRow);
  }
  
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('town_menu_upgrading').setLabel('Back').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    )
  );
  
  const { getCashflowField } = require('./town');
  embed.addFields(getCashflowField(player));

  return { embeds: [embed], components: rows };
}

export function handleGeneralAction(player: PlayerInventory, action: string, db: MinigameDB): string | any {
  if (!player.town) return `Town not found!`;
  if (!player.town.generals) player.town.generals = [];
  
  if (action === 'gacha_general') {
    if (player.town.tier < 4) return `⚠️ Gacha failed! You must upgrade your town to Tier 4 first.`;
    if ((player.town.generals?.length || 0) >= 2) return `❌ Batas maksimal 2 Jenderal sudah tercapai!`;
    
    const cost = getGachaCost(player.town.generals.length);
    if (player.coins < cost) return `❌ Not enough Coins! You need ${cost} Coin to recruit.`;
    
    // Gacha Rates: Common 0%, Rare 60%, Epic 30%, Legendary 10%
    const rand = Math.random();
    let targetRarity = 'Rare';
    if (rand > 0.9) targetRarity = 'Legendary';
    else if (rand > 0.6) targetRarity = 'Epic';
    
    const pool = GENERALS_DB.filter(g => g.rarity === targetRarity);
    if (pool.length === 0) return `⚠️ Gacha error: No generals in pool.`;
    const pulled = pool[Math.floor(Math.random() * pool.length)];
    
    player.coins -= cost;
    player.town.generals.push(pulled.id);
    saveMinigameDB(db);
    
    return `🎉 **GACHA SUCCESS!** You spent ${cost} Coin and recruited [${pulled.rarity}] **${pulled.name}**!\n> *${pulled.buffDesc}*`;
  }
  
  if (action.startsWith('recruit_char_')) {
    const charId = action.replace('recruit_char_', '');
    const { THREE_KINGDOMS_ROSTER } = require('./characters');
    const targetChar = THREE_KINGDOMS_ROSTER.find((c: any) => c.id === charId);
    if (!targetChar) return `❌ Character not found!`;
    
    if (!player.characters) player.characters = [];
    if (player.characters.some((c: any) => c.id === targetChar.id || c.id === `char_${targetChar.id}`)) {
      return `⚠️ Jenderal ${targetChar.name} sudah direkrut sebelumnya.`;
    }
    
    if (player.coins < targetChar.price) {
      return `❌ Koin tidak cukup! Butuh ${targetChar.price} Coin.`;
    }
    
    player.coins -= targetChar.price;
    player.characters.push(targetChar);
    if (!player.town.generals) player.town.generals = [];
    if (!player.town.generals.includes(targetChar.id)) {
      player.town.generals.push(targetChar.id);
    }
    if (typeof targetChar.effect === 'function') {
      targetChar.effect(player.town);
    }
    saveMinigameDB(db);
    return `📜 Berhasil merekrut Jenderal **${targetChar.name}** ke Kabinet Istana!`;
  }
  
  if (action.startsWith('equip_general_')) {
    const gId = action.replace('equip_general_', '');
    if (!player.town.generals.includes(gId)) return `❌ You don't own this general.`;
    const g = GENERALS_DB.find(x => x.id === gId);
    if (!player.town.activeParty) player.town.activeParty = [];
    
    const pIdx = player.town.activeParty.indexOf(gId);
    if (pIdx > -1) {
      player.town.activeParty.splice(pIdx, 1);
      saveMinigameDB(db);
      return `👑 You have removed **${g?.name}** from your party!`;
    } else {
      if (player.town.activeParty.length >= 2) {
        return `❌ Pesta Jenderal Anda sudah penuh! Lepas salah satu Jenderal terlebih dahulu (Maksimal 2 Jenderal).`;
      }
      player.town.activeParty.push(gId);
      // For legacy purposes
      player.town.activeGeneral = player.town.activeParty[0]; 
      saveMinigameDB(db);
      return `👑 You have added **${g?.name}** to your party!`;
    }
  }
  
  return renderGeneralsMenu(player, 'Gubernur', db);
}

export function getGeneralBuff(player: PlayerInventory, type: General['buffType']): number {
  if (!player.town?.activeGeneral) return 0;
  const g = GENERALS_DB.find(x => x.id === player.town!.activeGeneral);
  if (g && g.buffType === type) {
    return g.buffValue;
  }
  return 0;
}
