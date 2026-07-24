import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, saveMinigameDB } from '../minigame';

export const FACTIONS = {
  Shu: {
    name: 'Shu Han (Earth)',
    moraleBonus: 0.15,
    peasantUpkeepDiscount: 0.10,
    color: 0x2ECC71, // Green
    logo: 'https://cdn-icons-png.flaticon.com/512/10477/10477218.png', // Shield or earth representation
    description: '• **Morale Bonus:** +15% passive town morale.\n• **Peasant Upkeep:** -10% reduction in peasant hourly maintenance cost.'
  },
  Wei: {
    name: 'Cao Wei (Water)',
    metallurgyBonus: 0.10,
    armyUpkeepDiscount: 0.15,
    color: 0x3498DB, // Blue
    logo: 'https://cdn-icons-png.flaticon.com/512/10477/10477224.png', // Blue crest / water representation
    description: '• **Metal & Gold Mining:** +10% yield on quarry extraction.\n• **Army Upkeep:** -15% reduction in soldier hourly maintenance cost.'
  },
  Wu: {
    name: 'Eastern Wu (Fire)',
    commerceBonus: 0.15,
    buildCostDiscount: 0.10,
    color: 0xE74C3C, // Red
    logo: 'https://cdn-icons-png.flaticon.com/512/10477/10477213.png', // Flame crest / fire representation
    description: '• **Commerce Booster:** +15% income from Inns and Harbours.\n• **Contractors:** -10% discount on all building construction costs.'
  }
};

export function renderFactionSelection(userName: string) {
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🚩 CHOOSE YOUR FACTION ROLE')
    .setDescription(
      `Welcome, **${userName}**! Before establishing your domain, you must pledge allegiance to one of the three sovereign factions. ` +
      `Each faction grants special permanent benefits to your kingdom:\n\n` +
      `🟢 **Shu Han (Earth)**\n${FACTIONS.Shu.description}\n\n` +
      `🔵 **Cao Wei (Water)**\n${FACTIONS.Wei.description}\n\n` +
      `🔴 **Eastern Wu (Fire)**\n${FACTIONS.Wu.description}\n\n` +
      `*Click one of the buttons below to select your faction. Choose wisely, as this role cannot be changed!*`
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('fact_join_Shu').setLabel('Join Shu Han').setStyle(ButtonStyle.Success).setEmoji('🟢'),
    new ButtonBuilder().setCustomId('fact_join_Wei').setLabel('Join Cao Wei').setStyle(ButtonStyle.Primary).setEmoji('🔵'),
    new ButtonBuilder().setCustomId('fact_join_Wu').setLabel('Join Eastern Wu').setStyle(ButtonStyle.Danger).setEmoji('🔴')
  );

  return { embeds: [embed], components: [row] };
}

export function handleFactionJoin(db: any, player: PlayerInventory, factionKey: 'Shu' | 'Wei' | 'Wu', userName: string) {
  player.faction = factionKey;
  
  // Custom faction initializer settings
  if (!player.town) {
    player.town = {
      tier: 1,
      landSlots: 1,
      buildings: { 
        houses: 1, farms: 0, orchards: 0, ranches: 0, smithies: 0, quarries: 0, 
        towers: 0, hospitals: 0, taverns: 0, academies: 0, colosseums: 0, 
        kitchens: 0, treasuries: 0, wonders: 0, wells: 1, barracks: 0, 
        stables: 0, archeryRanges: 0, lumberMills: 0, marketplaces: 1, 
        harbours: 0, inns: 0, schools: 0 
      },
      buildingLevels: { 
        house: 1, farm: 1, orchard: 1, ranch: 1, smithy: 1, quarry: 1, 
        tower: 1, lumberMill: 1, marketplace: 1, harbour: 1, inn: 1, school: 1 
      },
      research: { advancedFarming: false, metallurgy: false },
      morale: 100,
      villagers: 2,
      animals: { chickens: 0, goats: 0, cows: 0, horses: 0 },
      lastAnimalIncome: Date.now(),
      food: { rice: 20, milk: 10, meat: 10, egg: 5, wool: 5 },
      weapons: { sword: 0, bow: 0, spear: 0, armor: 0 },
      horses: 0,
      peasantChildren: [],
      povertyRate: 0,
      hungerRate: 0
    };
  }

  saveMinigameDB(db);

  const embed = new EmbedBuilder()
    .setColor(FACTIONS[factionKey].color)
    .setThumbnail(FACTIONS[factionKey].logo)
    .setTitle(`🎉 Welcome to ${FACTIONS[factionKey].name}!`)
    .setDescription(
      `Congratulations, **${userName}**! You have joined the prestigious faksi of **${factionKey}**.\n\n` +
      `Your permanent faction benefits are now active:\n` +
      `${FACTIONS[factionKey].description}\n\n` +
      `Click the button below to enter your Capital Town!`
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Enter Capital').setStyle(ButtonStyle.Success).setEmoji('🏰')
  );

  return { embeds: [embed], components: [row] };
}
