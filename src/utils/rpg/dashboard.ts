import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { renderFactionSelection, FACTIONS } from './factions';
import { TIER_UPGRADES, TIER_NAMES } from './town';

function cleanActionName(str: string): string {
  if (!str) return str;
  let text = str;
  text = text.replace(/^\[AI-[A-Z]+\]\s*/, '');
  
  if (text.startsWith('recruit_char_')) {
    const charId = text.replace('recruit_char_', '').replace('char_', '');
    const formatted = charId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `📜 Merekrut Jenderal **${formatted}** ke Kabinet Istana`;
  }
  if (text === 'market_buy_food') return `🌾 Membeli Makanan Darurat di Pasar`;
  if (text.startsWith('market_sell_')) return `💰 Menjual Surplus Material di Pasar`;
  if (text === 'recruit_peasant') return `👨‍🌾 Merekrut Warga Desa Baru`;
  if (text === 'build_house') return `🏠 Membangun Rumah Baru`;
  if (text === 'build_farm') return `🌾 Membangun Ladang Pangan`;
  if (text === 'build_ranch') return `🐄 Mendirikan Peternakan (Ranch) Baru`;
  if (text === 'buy_animal_cow') return `🐄 Membeli 1 Sapi untuk Peternakan`;
  if (text === 'buy_animal_chicken') return `🐔 Membeli 1 Ayam untuk Peternakan`;
  if (text === 'buy_animal_goat') return `🐐 Membeli 1 Kambing untuk Peternakan`;
  if (text === 'forge_sword') return `⚒️ Menempa Pedang Baru`;
  if (text === 'forge_bow') return `🏹 Menempa Busur Baru`;
  if (text === 'forge_spear') return `🔱 Menempa Tombak Baru`;
  if (text === 'forge_armor') return `🛡️ Menempa Zirah Pelindung`;
  if (text === 'upgrade_tier') return `👑 Naik ke Tier Kerajaan Baru!`;
  if (text === 'buy_land') return `🗺️ Membeli Lahan Ekspansi Kota`;
  if (text === 'rebel_fight') return `🚨 Pasukan dikirim menumpas Pemberontak`;
  if (text.startsWith('equip_general_')) return `🎖️ Menugaskan Jenderal Utama`;

  return text;
}

function renderProgressBar(current: number, max: number, length: number = 6): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

function formatLog(log: string[]): string {
  if (!log || log.length === 0) return 'Belum ada aktivitas.';
  const cleanLogs = log.filter(l => !l.includes('Build failed') && !l.includes('fail') && !l.includes('Failed'));
  const display = cleanLogs.length > 0 ? cleanLogs : log;
  return display.slice(-3).map(l => '• ' + cleanActionName(l)).join('\n');
}

export function calculateHourlyCashflow(player: PlayerInventory) {
  const town: any = player.town || { tier: 1, landSlots: 5, villagers: 2, buildings: {}, food: {}, army: {} };
  const b: any = town.buildings || {};
  const army: any = town.army || {};
  const hasWu = player.faction === 'Wu';
  const tier = town.tier || 1;

  // 1. INCOME CALCULATION (PER HOUR)
  const innRate = (b.inns || 0) * 8;
  const harbourRate = (b.harbours || 0) * 15;
  const marketRate = (b.marketplaces || 0) * 6 * (town.buildingLevels?.marketplace || 1);
  const tierCommerceMult = 1 + ((tier - 1) * 0.20);
  const commerceBonus = hasWu ? 1.15 : 1.0;
  const commerceCoins = Math.floor((innRate + harbourRate + marketRate) * tierCommerceMult * commerceBonus);

  let taxCoins = 0;
  if (!town.isTaxExempt) {
    const policy = town.taxPolicy || 'normal';
    const policyMult = policy === 'light' ? 0.6 : (policy === 'heavy' ? 1.8 : 1.0);
    let taxWlPerMin = (town.villagers || 0) * 0.00833 * policyMult;
    if (town.nobles) taxWlPerMin += town.nobles * 0.0333;
    taxCoins = Math.floor(taxWlPerMin * 60);
  }

  // Resource Surplus Export Coins (Wood + Mining)
  const woodHourly = (b.lumberMills || 0) * 8;
  const woodExportCoins = Math.floor(woodHourly / 10);

  const miningHourly = (b.quarries || 0) * 4;
  const miningExportCoins = Math.floor(miningHourly / 5);

  const exportCoins = woodExportCoins + miningExportCoins;
  const totalCoinIncome = commerceCoins + taxCoins + exportCoins;

  // Resource Production (Per Hour)
  const woodIncome = woodHourly;
  const farmYieldMult = (town.research?.unlockedTechs?.includes('advancedFarming') || town.research?.advancedFarming) ? 1.2 : 1.0;
  const riceIncome = Math.floor((b.farms || 0) * 8 * farmYieldMult);
  
  const animals: any = town.animals || {};
  const meatIncome = ((animals.chickens || 0) * 2) + ((animals.cows || 0) * 2);
  const milkIncome = ((animals.goats || 0) * 2) + ((animals.cows || 0) * 4);

  // 2. EXPENSE CALCULATION (PER HOUR)
  const basicArmyCount = (army.infantry || 0) + (army.archers || 0) + (army.spearmen || 0);
  const cavalryCount = army.cavalry || 0;

  const basicUpkeepCost = Math.floor(basicArmyCount / 10);
  const cavCoinCost = cavalryCount * 1;
  const slots = town.landSlots || 1;
  const landTax = Math.floor(slots <= 10 ? (slots * 0.2) : (2 + (slots - 10) * 0.5));
  const infraUpkeep = Math.floor((town.villagers || 0) / 10);

  const armyUpkeep = basicUpkeepCost + cavCoinCost;
  const totalCoinExpense = armyUpkeep + landTax + infraUpkeep;
  const netCoinFlow = totalCoinIncome - totalCoinExpense;

  // Food Consumption (Per Hour)
  const totalArmyCount = basicArmyCount + cavalryCount;
  const riceExpense = Math.ceil(((town.villagers || 0) * 0.05) + (totalArmyCount * 0.10));
  const meatExpense = (cavalryCount * 3) + Math.ceil(totalArmyCount * 0.05);

  return {
    totalCoinIncome,
    commerceCoins,
    taxCoins,
    exportCoins,
    woodIncome,
    riceIncome,
    meatIncome,
    milkIncome,
    totalCoinExpense,
    landTax,
    infraUpkeep,
    armyUpkeep,
    netCoinFlow,
    riceExpense,
    meatExpense
  };
}

export function pushDashboardLog(player: PlayerInventory, msg: string) {
  if (!player.dashboardLog) player.dashboardLog = [];
  player.dashboardLog.push(msg);
  if (player.dashboardLog.length > 6) player.dashboardLog.shift();
  
  if (msg.includes(`${EMOJIS.unit_infantry}`) || msg.includes(`⚔️`) || msg.includes(`🐓`)) {
    setTimeout(async () => {
      try {
        const { client } = require('../../index');
        const { loadMinigameDB } = require('../minigame');
        const db = loadMinigameDB();
        const userId = Object.keys(db).find(k => db[k]?.discordName === player.discordName && k !== 'GLOBAL_STATE');
        if (userId) {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) {
            await user.send(`**[Town Notification — ${player.discordName}]**\n${msg}`).catch(() => null);
          }
        }
      } catch (e) {}
    }, 100);
  }
}

export function renderDashboard(player: PlayerInventory, userName: string) {
  const { usedSlots, TIER_UPGRADES, TIER_NAMES } = require('./town');
  const town = player.town || {
    tier: 1,
    landSlots: 5,
    villagers: 2,
    morale: 100,
    publicOrder: 100,
    buildings: { houses: 1, farms: 1, lumberMills: 0, quarries: 0, marketplaces: 1, inns: 0, harbours: 0, smithies: 0, hospitals: 0 },
    food: { rice: 100, milk: 0, meat: 50, egg: 0, wool: 0 },
    army: { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 },
    weapons: { sword: 0, bow: 0, spear: 0, armor: 0 }
  };

  const nextTier = (town.tier || 1) + 1;
  const upgradeReq = TIER_UPGRADES[nextTier];
  let reqStr = '🏆 Maximum tier reached! Your empire is legendary.';
  
  if (upgradeReq) {
    const curLand = town.landSlots || 0;
    const curV = town.villagers || 0;
    const reqLand = upgradeReq.requiredLand;
    const reqV = upgradeReq.requiredVillagers;
    const reqCoins = upgradeReq.wlsRequired;
    
    reqStr = `**Syarat Tier ${nextTier} (${TIER_NAMES[nextTier] || 'City'}):**\n` +
      `• 🗺️ Lahan: \`${curLand}/${reqLand}\` ${curLand >= reqLand ? '✅' : '❌'}\n` +
      `• 👨‍🌾 Warga: \`${curV}/${reqV}\` ${curV >= reqV ? '✅' : '❌'}\n` +
      `• 🪙 Coins: \`${(player.coins || 0).toLocaleString()}/${reqCoins.toLocaleString()}\` ${player.coins >= reqCoins ? '✅' : '❌'}`;
  }

  const factionName = player.faction ? (FACTIONS[player.faction]?.name || player.faction) : 'Unassigned';
  const { getCurrentSeason, getSeasonInfo } = require('./season');
  const season = getSeasonInfo(getCurrentSeason());

  const m = player.materials || {};
  const wood = Math.floor(m['Wood'] || 0);
  const iron = Math.floor(m['Iron'] || 0);
  const gold = Math.floor(m['Gold'] || 0);
  const silver = Math.floor(m['Silver'] || 0);
  const copper = Math.floor(m['Copper'] || 0);
  const rice = Math.floor(town.food?.rice || 0);
  const meat = Math.floor(town.food?.meat || 0);
  const wool = Math.floor(town.food?.wool || m['Wool'] || 0);

  const b: any = town.buildings || {};
  const used = usedSlots(town);
  const totalLand = town.landSlots || 5;
  const maxHousing = (b.houses || 1) * 10;

  const army: any = town.army || {};
  const wp: any = town.weapons || {};

  const moraleBar = renderProgressBar(town.morale ?? 100, 100, 6);
  const orderBar = renderProgressBar(Math.max(0, town.publicOrder ?? 100), 100, 6);

  // Active Cabinet / Generals Roster
  const activePartyNames = ((town as any).activeParty || []).map((gId: string) => {
    const { GENERALS_DB } = require('./generals');
    const gen = GENERALS_DB.find((x: any) => x.id === gId);
    return gen ? gen.name : gId;
  });
  const cabinetStr = activePartyNames.length > 0 ? activePartyNames.join(', ') : 'Belum Ditugaskan';

  const cf = calculateHourlyCashflow(player);
  const netStr = cf.netCoinFlow >= 0 ? `\`+${cf.netCoinFlow} Coin/jam\` ✅ (Untung)` : `\`${cf.netCoinFlow} Coin/jam\` ⚠️ (Defisit!)`;

  const kingdomTitleName = (player.discordName || userName || 'Hazzel').toUpperCase();

  const embed = new EmbedBuilder()
    .setColor(player.faction ? (FACTIONS[player.faction]?.color || 0x2ECC71) : 0x7F8C8D)
    .setTitle(`🏛️ KERAJAAN ${kingdomTitleName} — Tier ${town.tier || 1} (${TIER_NAMES[town.tier || 1] || 'Village'})`)
    .setDescription(
      `🚩 **Faksi:** ${factionName} | ${season.emoji} **Musim:** ${season.name}\n` +
      `❤️ **Morale:** \`${moraleBar}\` \`${town.morale ?? 100}%\` | 🛡️ **Keamanan:** \`${orderBar}\` \`${Math.round(town.publicOrder ?? 100)}/100\`\n` +
      `🤖 **Auto Play:** \`${player.isAuto ? 'ON (AI Active)' : 'OFF (Manual)'}\` | 🎖️ **Kabinet:** \`${cabinetStr}\``
    )
    .addFields(
      {
        name: `💰 KEKAYAAN & LOGISTIK`,
        value: 
          `🪙 **Coins:** \`${(player.coins || 0).toLocaleString()} Coin\`\n` +
          `🪵 **Kayu:** \`${wood}\` | ⛏️ **Besi:** \`${iron}\` | 🟡 **Gold:** \`${gold}\` | ⚪ **Silver:** \`${silver}\` | 🥉 **Copper:** \`${copper}\`\n` +
          `🌾 **Beras:** \`${rice}\` | 🥩 **Daging:** \`${meat}\` | 🧶 **Wol:** \`${wool}\``,
        inline: false
      },
      {
        name: `📈 ESTIMASI ARUS KAS & LOGISTIK (PER JAM)`,
        value:
          `🟢 **Pendapatan (+):** \`+${cf.totalCoinIncome} Coin/jam\` (Pasar: +${cf.commerceCoins}, Pajak: +${cf.taxCoins}, Ekspor Surplus: +${cf.exportCoins})\n` +
          `🔴 **Pengeluaran (-):** \`-${cf.totalCoinExpense} Coin/jam\` (Lahan: -${cf.landTax}, Infra: -${cf.infraUpkeep}, Gaji Pasukan: -${cf.armyUpkeep})\n` +
          `⚖️ **Surplus Bersih:** ${netStr}\n` +
          `🌾 **Pangan/jam:** Beras \`+${cf.riceIncome}/-${cf.riceExpense}\` | Daging \`+${cf.meatIncome}/-${cf.meatExpense}\` | Kayu \`+${cf.woodIncome}/jam\``,
        inline: false
      },
      {
        name: `🏛️ DOMAIN & BANGUNAN KOTA`,
        value: 
          `🗺️ **Lahan:** \`${used}/${totalLand}\` Slot | 👨‍🌾 **Warga:** \`${town.villagers}/${maxHousing}\` Orang\n` +
          `🏠 Rumah: **${b.houses || 0}** | 🌾 Ladang: **${b.farms || 0}** | 🐄 Peternakan: **${b.ranches || 0}** | 🏪 Pasar: **${b.marketplaces || 0}** | 🪵 Kilang Kayu: **${b.lumberMills || 0}** | ⛏️ Tambang: **${b.quarries || 0}**\n` +
          `🔨 Smithy: **${b.smithies || 0}** | 🏨 Inn: **${b.inns || 0}** | ⚓ Pelabuhan: **${b.harbours || 0}** | 🏥 Rumah Sakit: **${b.hospitals || 0}** | 🐎 Stable: **${b.stables || 0}** | 🛠️ Workshop: **${b.workshops || 0}**\n` +
          `📦 Gudang: **${b.warehouses || 0}** | 🏫 Sekolah: **${b.schools || 0}** | 🛡️ Tower: **${b.towers || 0}**`,
        inline: false
      },
      {
        name: `⚔️ PASUKAN & ARSENAL`,
        value: 
          `🗡️ Infantri: **${army.infantry || 0}** | 🏹 Archer: **${army.archers || 0}** | 🐎 Kavaleri: **${army.cavalry || 0}** | 🔱 Spearman: **${army.spearmen || 0}**\n` +
          `🗡️ Pedang: \`${wp.sword || 0}\` | 🏹 Busur: \`${wp.bow || 0}\` | 🔱 Tombak: \`${wp.spear || 0}\` | 🛡️ Zirah: \`${wp.armor || 0}\``,
        inline: false
      },
      {
        name: `📜 TUGAS UPGRADE TIER`,
        value: reqStr,
        inline: false
      },
      {
        name: `📋 RIWAYAT AKTIVITAS`,
        value: formatLog(player.dashboardLog || []),
        inline: false
      }
    )
    .setTimestamp();

  // Unified Calibrated Action Buttons (3 Clean Rows)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('town_build_menu').setLabel('Bangun').setEmoji('🔨').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('town_buyland').setLabel('Beli Lahan').setEmoji('🗺️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('town_recruit_peasant').setLabel('Rekrut Warga').setEmoji('👨‍🌾').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('town_claim_profit').setLabel('Klaim Profit').setEmoji('💰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('town_upgrade').setLabel('Upgrade Tier').setEmoji('🆙').setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('town_generals').setLabel('Jenderal').setEmoji(EMOJIS.fac_shu || '🎴').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('town_army').setLabel('Barak Pasukan').setEmoji(EMOJIS.unit_infantry || '🥷').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('town_siege_menu').setLabel('Perang Penaklukan').setEmoji(EMOJIS.act_siege || '⚔️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('town_deploy_dungeon').setLabel('Dungeon Ekspedisi').setEmoji(EMOJIS.map_capital || '🏰').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('town_deploy_boss').setLabel('World Boss Raid').setEmoji(EMOJIS.boss_lubu || '👹').setStyle(ButtonStyle.Danger)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('town_animals').setLabel('Beli Ternak').setEmoji('🐄').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dash_auction').setLabel('Pasar Lelang').setEmoji('🏛️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('town_research').setLabel('Riset Tech').setEmoji('🧪').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('town_toggle_auto').setLabel(player.isAuto ? 'Auto: ON' : 'Auto: OFF').setEmoji('🤖').setStyle(player.isAuto ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

export async function handleDashboardAction(db: any, player: PlayerInventory, action: string, userName: string): Promise<any> {
  if (action === 'auction') {
    const { handleAuction } = require('./auction');
    const playerId = Object.keys(db.players || db).find(k => (db.players ? db.players[k] : db[k]) === player) || '';
    const res = handleAuction(db, player, playerId, userName, ['view']);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Back').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    res.components = [row];
    return res;
  }
  
  if (action === 'fullmap') {
    const { renderFullMapMenu } = require('./map');
    return renderFullMapMenu(player, userName, db);
  }

  if (action === 'treasury') {
    const m = player.materials || {};
    const silver = m['Silver'] || 0;
    const gold = m['Gold'] || 0;
    const copper = m['Copper'] || 0;
    const iron = m['Iron'] || 0;
    const wood = m['Wood'] || 0;

    const f = player.town?.food || { rice: 0, milk: 0, meat: 0, egg: 0, wool: 0 };
    const w = player.town?.weapons || { sword: 0, bow: 0, spear: 0, armor: 0 };
    const h = player.town?.horses || 0;

    const embed = new EmbedBuilder()
      .setColor(0x00FFBB)
      .setTitle(`🏛️ Town Treasury — ${userName}`)
      .setDescription(
        `Review the kingdom stockpiles, food reserves, weapons, and material resources in your treasury:\n\n` +
        `🧱 **METALS & WOOD**\n` +
        `${EMOJIS.res_wood} **Wood:** \`${Math.floor(wood)} Units\`\n` +
        `${EMOJIS.res_coin} **Gold:** \`${Math.floor(gold)} Units\`\n` +
        `🥈 **Silver:** \`${Math.floor(silver)} Units\`\n` +
        `🥉 **Copper:** \`${Math.floor(copper)} Units\`\n` +
        `🔩 **Iron:** \`${Math.floor(iron)} Units\`\n\n` +
        `${EMOJIS.res_grain} **FOOD RESERVES**\n` +
        `${EMOJIS.res_grain} **Rice:** \`${Math.floor(f.rice)} Units\`\n` +
        `🥛 **Milk:** \`${Math.floor(f.milk)} Units\`\n` +
        `${EMOJIS.res_meat} **Meat:** \`${Math.floor(f.meat)} Units\`\n` +
        `🥚 **Eggs:** \`${Math.floor(f.egg)} Units\`\n` +
        `🧶 **Wool:** \`${Math.floor(f.wool)} Units\`\n\n` +
        `${EMOJIS.unit_infantry} **MILITARY ASSETS**\n` +
        `🗡️ **Swords:** \`${Math.floor(w.sword)} Pcs\`\n` +
        `🏹 **Bows:** \`${Math.floor(w.bow)} Pcs\`\n` +
        `🔱 **Spears:** \`${Math.floor(w.spear)} Pcs\`\n` +
        `👕 **Armors:** \`${Math.floor(w.armor)} Pcs\`\n` +
        `🐎 **Horses:** \`${Math.floor(h)} Horses\`\n\n` +
        `*Note: Materials and food are produced passively by town industries, crops, and ranches.*`
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Back').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
  }

  if (action === 'faction') {
    if (!player.faction) {
      return renderFactionSelection(userName);
    }
    const factionData = FACTIONS[player.faction];
    const embed = new EmbedBuilder()
      .setColor(factionData.color)
      .setThumbnail(factionData.logo)
      .setTitle(`🚩 Faction Alliance — ${factionData.name}`)
      .setDescription(
        `Your domain is currently aligned with the sovereign state of **${factionData.name}**.\n\n` +
        `**Active Permanent Buffs:**\n` +
        `${factionData.description}\n\n` +
        `*Note: Faction alignment is permanent and cannot be modified.*`
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_refresh').setLabel('Back').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
  }

  // ==================
  // TOWN MENU
  // ==================
  if (action === 'town') {
    const { renderTownMenu } = require('./town');
    return renderTownMenu(player, userName, db);
  }

  saveMinigameDB(db);
  return renderDashboard(player, userName);
}
