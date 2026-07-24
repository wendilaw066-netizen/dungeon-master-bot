import { Guild, TextChannel, EmbedBuilder, ChannelType } from 'discord.js';

export async function getOrCreateKingdomChat(guild: Guild): Promise<TextChannel | null> {
  const channel = guild.channels.cache.get('1419848898293268485') as TextChannel;
  return channel || null;
}

export async function announceBanditRaid(guild: Guild, username: string, success: boolean, lossDetails: string) {
  const ch = await getOrCreateKingdomChat(guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(success ? 0x2ECC71 : 0xE74C3C)
    .setTitle(success ? `🛡️ CITY DEFENSE SUCCESSFUL` : `🚨 BANDIT RAID PLUNDER REPORT`)
    .setDescription(
      success
        ? `• **Governor ${username}** successfully repelled an invading bandit squad!\n• Defense forces held the perimeter. No casualties reported.`
        : `• **Governor ${username}**'s town was ransacked by fierce bandits!\n• Plundered assets: ${lossDetails}`
    )
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function announceAlliance(guild: Guild, user1: string, user2: string) {
  const ch = guild.client.channels.cache.get('1529016278474293358') as TextChannel;
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🤝 SOVEREIGN ALLIANCE DECLARED`)
    .setDescription(
      `• A grand alliance has been forged in the realm!\n` +
      `• **Governor ${user1}** and **Governor ${user2}** have signed a treaty of mutual aid and defense.`
    )
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function announceTrade(guild: Guild, user1: string, user2: string, details: string) {
  const ch = guild.client.channels.cache.get('1529016278474293358') as TextChannel;
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`⚖️ MERCHANTS TRADE COMPLETED`)
    .setDescription(
      `• Direct trade caravan successfully returned to their capital!\n` +
      `• Contract signed between **Governor ${user1}** and **Governor ${user2}**.\n` +
      `• Details: ${details}`
    )
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function announceSiege(guild: Guild, attacker: string, defender: string, success: boolean, details: string) {
  const ch = await getOrCreateKingdomChat(guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(success ? 0x2ECC71 : 0xC0392B)
    .setTitle(success ? `🏰 SIEGE VICTORY REPORT` : `🛡️ SIEGE DEFENSE VICTORY`)
    .setDescription(
      success
        ? `• **Governor ${attacker}** has successfully sieged the walls of **Governor ${defender}**!\n• Loot acquired: ${details}`
        : `• **Governor ${attacker}**'s offensive raid on **Governor ${defender}** was utterly repelled!\n• Defender forces held the gates. Details: ${details}`
    )
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function triggerRandomEvent(client: any) {
  const { loadMinigameDB, saveMinigameDB, getPlayer } = require('../minigame');
  const db = loadMinigameDB();
  const playerIds = Object.keys(db);
  if (playerIds.length === 0) return '❌ No players registered in database.';

  // Select a random player/bot
  const targetId = playerIds[Math.floor(Math.random() * playerIds.length)];
  const player = getPlayer(db, targetId);
  const targetName = player.discordName || `Governor_${targetId}`;

  if (!player.town) return `❌ ${targetName} does not have a town established yet.`;

  const events = [
    {
      name: '⛈️ Severe Thunderstorm',
      desc: 'A raging storm hits the city limits, damaging crops and local infrastructure.',
      modDesc: 'Morale -10% and Rice reserves decreased by 10 units.',
      apply: (p: any) => {
        if (p.town) {
          p.town.morale = Math.max(0, (p.town.morale || 100) - 10);
          if (p.town.food) p.town.food.rice = Math.max(0, (p.town.food.rice || 0) - 10);
        }
      }
    },
    {
      name: '🚂 Travelling Silk Road Merchants',
      desc: 'A wealthy merchant caravan arrives at the local markets to purchase exotic goods.',
      modDesc: 'Market income boost +20% and Treasury Coins +10.',
      apply: (p: any) => {
        p.coins = (p.coins || 0) + 10;
        if (p.town) p.town.publicOrder = Math.min(100, (p.town.publicOrder || 100) + 10);
      }
    },
    {
      name: '🐛 Locust Swarm Infestation',
      desc: 'Swarms of ravenous locusts migrate over agricultural fields eating everything.',
      modDesc: 'Rice reserves decreased by 30 units and Morale -5%.',
      apply: (p: any) => {
        if (p.town) {
          p.town.morale = Math.max(0, (p.town.morale || 100) - 5);
          if (p.town.food) p.town.food.rice = Math.max(0, (p.town.food.rice || 0) - 30);
        }
      }
    },
    {
      name: '💎 Underground Mineral Vein Discovery',
      desc: 'Local quarry workers stumble upon a rich mineral vein containing high-grade ores.',
      modDesc: 'Iron +15, Copper +15, and Silver +5 units added to Treasury.',
      apply: (p: any) => {
        if (!p.materials) p.materials = {};
        p.materials['Iron'] = (p.materials['Iron'] || 0) + 15;
        p.materials['Copper'] = (p.materials['Copper'] || 0) + 15;
        p.materials['Silver'] = (p.materials['Silver'] || 0) + 5;
      }
    },
    {
      name: '👹 Nomadic Bandit Scouting Party',
      desc: 'Fierce bandits scout the city walls. Guards lock down the city gates.',
      modDesc: 'Public Order -15 points due to security panic.',
      apply: (p: any) => {
        if (p.town) p.town.publicOrder = Math.max(-100, (p.town.publicOrder || 100) - 15);
      }
    },
    {
      name: '📖 Influx of Imperial Scholars',
      desc: 'Scholars escaping provincial wars settle in your city, setting up schools.',
      modDesc: 'Public Order +20 points and research motivation increases.',
      apply: (p: any) => {
        if (p.town) p.town.publicOrder = Math.min(100, (p.town.publicOrder || 100) + 20);
      }
    }
  ];

  const activeEvent = events[Math.floor(Math.random() * events.length)];
  activeEvent.apply(player);
  saveMinigameDB(db);

  let announced = false;
  try {
    const ch = await client.channels.fetch('1529016344992022538');
    if (ch && ch.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`🚨 REGIONAL EVENT THREAT/REPORT: ${activeEvent.name.toUpperCase()}`)
        .setDescription(
          `**Affected Territory:** \`${targetName}\`'s domain\n\n` +
          `• **Event Details:** ${activeEvent.desc}\n` +
          `• **Modifiers Applied:** ${activeEvent.modDesc}\n\n` +
          `*Self-learning AI Imaginative Event Engine generated.*`
        )
        .setTimestamp();
      await (ch as TextChannel).send({ embeds: [embed] }).catch(() => {});
      announced = true;
    }
  } catch (e) {
    // Ignore fetch error
  }

  return `✅ **Event triggered successfully!** Raised event **"${activeEvent.name}"** affecting **${targetName}**. Output broadcasted: ${announced ? 'Yes' : 'No'}`;
}
