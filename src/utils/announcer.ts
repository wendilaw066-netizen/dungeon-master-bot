/**
 * announcer.ts
 * Handles world-announcement channel creation and all global broadcast messages.
 * - Legendary/Epic gacha pulls
 * - Legendary GT item drops from dungeon
 * - Active events
 */
import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

export const ANNOUNCE_CHANNEL_NAME = 'world-announcements';

// ────────────────────────────────────────────────────────────
// Ensure the announce channel exists (create if missing)
// ────────────────────────────────────────────────────────────
export async function getOrCreateAnnounceChannel(guild: Guild): Promise<TextChannel | null> {
  try {
    const guildAreaCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('guild area')
    );

    // Try cache first
    let ch = guild.channels.cache.find(
      c => c.name === ANNOUNCE_CHANNEL_NAME && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    if (ch) {
      if (guildAreaCategory && ch.parentId !== guildAreaCategory.id) {
        await ch.setParent(guildAreaCategory.id, { lockPermissions: false }).catch((err) => {
          console.error('[Announcer] Failed to set parent category:', err);
        });
      }
      return ch;
    }

    // Not found — create it
    ch = await guild.channels.create({
      name: ANNOUNCE_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: '🌍 Pengumuman otomatis: Drop Legendary, Event aktif, dan pencapaian luar biasa pemain ZHU!',
      parent: guildAreaCategory ? guildAreaCategory.id : undefined,
      // Set slow-mode to prevent spam (30s)
      rateLimitPerUser: 30,
      permissionOverwrites: [
        {
          // Everyone can READ but NOT send messages
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
      ],
    }) as TextChannel;

    // Post a welcome banner right away
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Selamat Datang di World Announcements!')
      .setDescription(
        '📢 Channel ini adalah **pusat pengumuman otomatis** bot ZHU!\n\n' +
        'Di sini kamu akan melihat:\n' +
        '🎰 **Drop Legendary/Epic** dari Gacha\n' +
        '🎮 **Item Legendary** dari Dungeon\n' +
        '🎉 **Event aktif** dan pengumuman khusus\n\n' +
        '*Raih item Legendary dan namamu akan terpampang di sini!*'
      )
      .setFooter({ text: 'ZHU Bot • World Announcements System' })
      .setTimestamp();

    await ch.send({ content: '@everyone', embeds: [welcomeEmbed] });
    return ch;
  } catch (err) {
    console.error('[Announcer] Failed to get/create announce channel:', err);
    return null;
  }
}


// ────────────────────────────────────────────────────────────
// Announce: Legendary/Epic Gacha Pull
// ────────────────────────────────────────────────────────────
export async function announceGachaPull(
  guild: Guild,
  userId: string,
  username: string,
  itemName: string,
  rarity: string,
  itemDesc: string,
  atk: number,
  hp: number,
): Promise<void> {
  const ch = await getOrCreateAnnounceChannel(guild);
  if (!ch) return;

  const isLegendary = rarity === 'Legendary';
  const color = isLegendary ? 0xFFD700 : 0x9B59B6;
  const emoji = isLegendary ? '🌟' : '💜';
  const badge = isLegendary
    ? '🌟  **L E G E N D A R Y**  🌟'
    : '💜  **E P I C**  💜';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} WORLD MESSAGE — ${rarity.toUpperCase()} GACHA PULL!`)
    .setDescription(
      `${badge}\n\n` +
      `🎰 **<@${userId}>** baru saja mendapatkan item **${rarity}** dari Gacha!\n\n` +
      `> **${itemName}**\n` +
      `> ${itemDesc}\n\n` +
      `⚔️ ATK +**${atk}**  •  ❤️ HP +**${hp}**`
    )
    .setFooter({ text: `Guild ZHU • Selamat ${username}! 🎊` })
    .setTimestamp();

  await ch.send({
    content: isLegendary ? '@everyone 🎊 ADA YANG DAPET LEGENDARY! 🎊' : '',
    embeds: [embed],
  }).catch(() => {});
}

// ────────────────────────────────────────────────────────────
// Announce: Legendary GT Item Drop from Dungeon
// ────────────────────────────────────────────────────────────
export async function announceGtItemDrop(
  guild: Guild,
  userId: string,
  username: string,
  itemName: string,
  rarity: string,
  dungeonDiff: string,
): Promise<void> {
  if (rarity !== 'Legendary' && rarity !== 'Epic') return;

  const ch = await getOrCreateAnnounceChannel(guild);
  if (!ch) return;

  const isLegendary = rarity === 'Legendary';
  const color = isLegendary ? 0xFFD700 : 0x9B59B6;
  const emoji = isLegendary ? '🏆' : '🎮';
  const badge = isLegendary ? '🌟 **LEGENDARY DROP** 🌟' : '💜 **EPIC DROP** 💜';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} WORLD MESSAGE — ${rarity.toUpperCase()} DUNGEON DROP!`)
    .setDescription(
      `${badge}\n\n` +
      `⚔️ **<@${userId}>** berhasil mendapatkan item **${rarity}** dari Dungeon!\n\n` +
      `> 🎮 **${itemName}**\n` +
      `> 📍 Dungeon: **${dungeonDiff}**\n\n` +
      `*Jual dengan \`!jual ${itemName}\` atau simpan sebagai koleksi!*`
    )
    .setFooter({ text: `Guild ZHU • Selamat ${username}! 🏆` })
    .setTimestamp();

  await ch.send({
    content: isLegendary ? '@everyone 🔥 DROP LEGENDARY DI DUNGEON! 🔥' : '',
    embeds: [embed],
  }).catch(() => {});
}

// ────────────────────────────────────────────────────────────
// Announce: Custom Event
// ────────────────────────────────────────────────────────────
export async function announceEvent(
  guild: Guild,
  eventTitle: string,
  eventDesc: string,
  durationText: string,
): Promise<void> {
  const ch = await getOrCreateAnnounceChannel(guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle(`🎉 EVENT AKTIF: ${eventTitle}`)
    .setDescription(eventDesc)
    .addFields({ name: '⏰ Durasi', value: durationText, inline: true })
    .setFooter({ text: 'ZHU Bot • Event Announcement' })
    .setTimestamp();

  await ch.send({
    content: '@everyone 📣 **EVENT BARU DIMULAI!**',
    embeds: [embed],
  }).catch(() => {});
}
