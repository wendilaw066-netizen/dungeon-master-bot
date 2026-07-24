import { EMOJIS } from './emojis';
import { Client, EmbedBuilder, Guild } from 'discord.js';
import { getOrCreateAnnounceChannel, announceGtItemDrop } from '../announcer';
import { COLORS, hpBar, fmt } from './ui';
import { getPlayer, loadMinigameDB, saveMinigameDB, PlayerInventory } from '../minigame';
import { calculatePlayerStats } from './equipment';
import { rollSpecificGtItemDrop, RARITY_EMOJI_GT, GtRarity } from './items';
import { loadWorldDB, saveWorldDB } from './world';

export interface WorldBoss {
  name: string;
  hp: number;
  maxHp: number;
  attackers: Record<string, { username: string; damage: number }>;
  isActive: boolean;
}

export const activeWorldBoss: WorldBoss = {
  name: 'World Boss',
  hp: 0,
  maxHp: 0,
  attackers: {},
  isActive: false
};

const BOSS_NAMES = ['Abyssal Dragon', 'Void Titan', 'Shadow Colossus', 'Infernal Behemoth', 'Celestial Guardian'];

export async function spawnWorldBoss(client: Client) {
  if (activeWorldBoss.isActive) return; // Already active

  activeWorldBoss.name = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
  activeWorldBoss.maxHp = 50000;
  activeWorldBoss.hp = activeWorldBoss.maxHp;
  activeWorldBoss.attackers = {};
  activeWorldBoss.isActive = true;

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`${EMOJIS.boss_monster} WORLD BOSS ACTIVE THREAT REPORT`)
    .setDescription(
      `An ancient colossal monster has breached our territorial borders! Assemble the regional armies and march forward to reclaim peace.\n\n` +
      `**BOSS NAME:** \`${activeWorldBoss.name}\`\n\n` +
      `• **Objective:** Cooperate with other governors to drain the beast's HP reserves.\n` +
      `• **Rewards:** Guaranteed **Rare+ Legendary Equipment** distributed to all battle participants.\n` +
      `• **How to Fight:** Type **\`!boss attack\`** in any guild text channel to strike the active boss!`
    )
    .addFields({ name: 'HP RESERVES', value: `${hpBar(activeWorldBoss.hp, activeWorldBoss.maxHp)}\n**${fmt(activeWorldBoss.hp)}** / ${fmt(activeWorldBoss.maxHp)}` })
    .setTimestamp();

  // Broadcast to all guilds where we have announce channel
  for (const guild of client.guilds.cache.values()) {
    const ch = await getOrCreateAnnounceChannel(guild);
    if (ch) {
      ch.send({ content: `@everyone ${EMOJIS.unit_infantry} **WORLD BOSS SPAWNED!**`, embeds: [embed] }).catch(() => {});
    }
  }
}

export async function handleBossAttack(userId: string, username: string, client: Client, guild: Guild | null, baseDamage?: number): Promise<EmbedBuilder> {
  if (!activeWorldBoss.isActive || activeWorldBoss.hp <= 0) {
    return new EmbedBuilder()
      .setColor(COLORS.INFO as any)
      .setTitle('❌ NO ACTIVE BOSS THREAT')
      .setDescription(
        `• There are currently no active world bosses in the region.\n` +
        `• A new threat spawns automatically every 30 minutes. Prepare your weaponry!`
      );
  }

  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  
  // Calculate damage
  let dmg = 0;
  let isCrit = false;
  if (baseDamage !== undefined) {
    dmg = baseDamage;
  } else {
    const stats = calculatePlayerStats(player);
    dmg = stats.attack + Math.floor(Math.random() * (stats.attack * 0.5));
    isCrit = Math.random() < 0.2;
    if (isCrit) dmg *= 2;
  }

  // Apply damage
  activeWorldBoss.hp = Math.max(0, activeWorldBoss.hp - dmg);
  
  // Record attacker
  if (!activeWorldBoss.attackers[userId]) {
    activeWorldBoss.attackers[userId] = { username, damage: 0 };
  }
  activeWorldBoss.attackers[userId].damage += dmg;

  let desc = `You attacked **${activeWorldBoss.name}**!\n`;
  desc += isCrit ? `💥 **CRITICAL HIT!** Deals **${fmt(dmg)}** damage!\n` : `${EMOJIS.unit_infantry} Deals **${fmt(dmg)}** damage!\n`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.BOSS as any)
    .setTitle(`${EMOJIS.unit_infantry} WORLD BOSS BATTLE`);

  // Boss defeated!
  if (activeWorldBoss.hp === 0) {
    activeWorldBoss.isActive = false;
    desc += `\n🎉 **BOSS VANQUISHED!** 🎉\nDistributing war spoils to all active armies...`;
    embed.setDescription(desc);
    embed.addFields({ name: 'Status', value: `☠️ **${activeWorldBoss.name}** has fallen.` });
    
    // Process rewards
    setTimeout(() => processBossDefeat(client, activeWorldBoss.name, Object.assign({}, activeWorldBoss.attackers)), 100);
    
    return embed;
  } else {
    desc += `\nContinue striking the boss with \`!boss attack\`!`;
    embed.setDescription(desc);
    embed.addFields({ name: 'Remaining HP', value: `${hpBar(activeWorldBoss.hp, activeWorldBoss.maxHp)}\n**${fmt(activeWorldBoss.hp)}** / ${fmt(activeWorldBoss.maxHp)}` });
    return embed;
  }
}

async function processBossDefeat(client: Client, bossName: string, attackers: Record<string, { username: string; damage: number }>) {
  const db = loadMinigameDB();
  const rewardLog: string[] = [];
  const factionDamage: Record<string, number> = {};

  const participants = Object.keys(attackers);
  if (participants.length === 0) return;

  // Sort by damage to find MVP
  const sorted = Object.entries(attackers).sort(([,a], [,b]) => b.damage - a.damage);
  const mvpId = sorted[0][0];

  for (const [uid, data] of sorted) {
    const p = getPlayer(db, uid);
    
    // Guild War Faction Tracking
    const faction = p.faction || 'Shu';
    factionDamage[faction] = (factionDamage[faction] || 0) + data.damage;

    // Base gem reward for participating (legacy, keep for DB structure consistency)
    const gemsWon = 2000 + Math.floor(Math.random() * 3000);
    p.coins += Math.floor(gemsWon / 1000); // convert gems to Coin

    const isMvp = uid === mvpId;
    let allowedRarities: GtRarity[] = ['Rare', 'Epic'];
    if (isMvp) allowedRarities = ['Epic', 'Epic', 'Legendary'];
    else if (Math.random() < 0.2) allowedRarities.push('Legendary');

    const drop = rollSpecificGtItemDrop(allowedRarities);
    let dropText = '*No equipment drop*';

    if (drop) {
      if (!p.gtItems) p.gtItems = [];
      if (p.gtItems.length < 15) {
        p.gtItems.push(drop.name);
        dropText = `${RARITY_EMOJI_GT[drop.rarity]} **${drop.name}** (${drop.rarity})`;
      } else {
        dropText = `*GT Stockpile full, failed to claim*`;
      }
    }

    let line = `• **${data.username}** (Dmg: ${fmt(data.damage)}) ➔ ${EMOJIS.res_coin} ${Math.floor(gemsWon / 1000)} Coin | 🎁 ${dropText}`;
    if (isMvp) line = `👑 MVP ` + line;
    rewardLog.push(line);
  }

  saveMinigameDB(db);

  let rulingStr = '';
  const sortedFactions = Object.entries(factionDamage).sort(([,a], [,b]) => b - a);
  if (sortedFactions.length > 0) {
    const worldDb = loadWorldDB();
    worldDb.rulingFaction = sortedFactions[0][0];
    saveWorldDB(worldDb);
    rulingStr = `\n\n👑 **GUILD WARS RESULT:** Faction **${sortedFactions[0][0]}** dealt the most damage and is now the **RULING FACTION**! Their citizens receive +10% passive income!`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`🎉 WORLD BOSS DEFEATED REPORT`)
    .setDescription(
      `Victory! The threat of **${bossName}** has been vanquished from our land! Treasury loot, currency rewards, and rare equipment drops have been distributed to all regional armies:\n\n` +
      `${rewardLog.join('\n')}` +
      rulingStr
    )
    .setFooter({ text: 'Next colossal monster alert scheduled in 30 minutes!' })
    .setTimestamp();

  // Broadcast results
  for (const guild of client.guilds.cache.values()) {
    const ch = await getOrCreateAnnounceChannel(guild);
    if (ch) {
      ch.send({ embeds: [embed] }).catch(() => {});
    }
  }
}
