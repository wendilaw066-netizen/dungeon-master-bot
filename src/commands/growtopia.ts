import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { db } from '../database';
import { startSimulation, stopSimulation, isSimulationRunning } from '../utils/simulation';

const PRICES_PATH = path.join(process.cwd(), 'growtopia-prices.json');
const ITEMS_PATH = path.join(process.cwd(), 'growtopia-items.json');

// Interface for Price DB
interface PriceData {
  item: string;
  priceRange: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  updatedBy: string;
  updatedAt: number;
}

interface PriceDb {
  [key: string]: PriceData;
}

interface ItemData {
  item: string;
  description: string;
  image?: string;
}

interface ItemsDb {
  [key: string]: ItemData;
}

// Load Price DB
function loadPrices(): PriceDb {
  try {
    if (fs.existsSync(PRICES_PATH)) {
      return JSON.parse(fs.readFileSync(PRICES_PATH, 'utf-8'));
    }
  } catch (error) {
    logger.error('Failed to load growtopia-prices.json:', 'Growtopia');
  }
  return {};
}

// Load Items DB
function loadItems(): ItemsDb {
  try {
    if (fs.existsSync(ITEMS_PATH)) {
      return JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
    }
  } catch (error) {
    logger.error('Failed to load growtopia-items.json:', 'Growtopia');
  }
  return {};
}

// Save Price DB
function savePrices(db: PriceDb) {
  try {
    fs.writeFileSync(PRICES_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save growtopia-prices.json:', 'Growtopia');
  }
}

// Cooldown Cache for /trade-post (Map of userId -> timestamp)
const tradeCooldowns = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// =========================================================
// 1. CONVERT COMMAND
// =========================================================
const convertCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Kalkulator konversi Coin, DL, dan BGL Growtopia.')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Jumlah kunci yang ingin dikonversi').setRequired(true).setMinValue(1))
    .addStringOption(opt => opt.setName('type').setDescription('Jenis kunci asal').setRequired(true)
      .addChoices(
        { name: 'World Lock (Coin)', value: 'Coin' },
        { name: 'Diamond Lock (DL)', value: 'DL' },
        { name: 'Blue Gem Lock (BGL)', value: 'BGL' }
      )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount')!;
    const type = interaction.options.getString('type')!;

    let totalWL = 0;
    if (type === 'Coin') {
      totalWL = amount;
    } else if (type === 'DL') {
      totalWL = amount * 100;
    } else if (type === 'BGL') {
      totalWL = amount * 10000;
    }

    const bgls = Math.floor(totalWL / 10000);
    const remainderAfterBgl = totalWL % 10000;
    const dls = Math.floor(remainderAfterBgl / 100);
    const coins = remainderAfterBgl % 100;

    const embed = new EmbedBuilder()
      .setColor(0xffaa00) // Gold color
      .setTitle('🧮 Growtopia Lock Converter')
      .setDescription(`Hasil konversi dari **${amount.toLocaleString()} ${type}**:`)
      .addFields(
        { name: '🔵 Blue Gem Locks (BGL)', value: `\`${bgls.toLocaleString()}\` BGL`, inline: true },
        { name: '💎 Diamond Locks (DL)', value: `\`${dls.toLocaleString()}\` DL`, inline: true },
        { name: '🟢 World Locks (Coin)', value: `\`${coins.toLocaleString()}\` Coin`, inline: true }
      )
      .setFooter({ text: `Total nilai setara: ${totalWL.toLocaleString()} Coin` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

// =========================================================
// 2. PRICE CHECK COMMAND
// =========================================================
const priceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('price')
    .setDescription('Cek harga barang pasar Growtopia terupdate.')
    .addStringOption(opt => opt.setName('item').setDescription('Nama item yang ingin dicari').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const db = loadPrices();
    const choices = Object.keys(db);
    const filtered = choices
      .filter(choice => choice.includes(focusedValue))
      .slice(0, 25);
    await interaction.respond(
      filtered.map(choice => {
        let name = db[choice].item;
        if (name.length > 100) name = name.substring(0, 97) + '...';
        if (name.length === 0) name = 'Unnamed Item';
        return { name: name, value: name.substring(0, 100) };
      })
    );
  },
  async execute(interaction: ChatInputCommandInteraction) {
    const itemNameInput = interaction.options.getString('item')!.trim().toLowerCase();
    const db = loadPrices();

    let foundKey = Object.keys(db).find(key => key.toLowerCase() === itemNameInput);
    if (!foundKey) {
      foundKey = Object.keys(db).find(key => key.toLowerCase().includes(itemNameInput));
    }

    if (!foundKey) {
      await interaction.reply({
        content: `❌ Item **"${interaction.options.getString('item')}"** tidak ditemukan di database harga server.\n💡 *Coba cari deskripsi resmi item ini menggunakan command: \`/item name:${interaction.options.getString('item')}\`*`,
        ephemeral: true
      });
      return;
    }

    const price = db[foundKey];
    const trendEmojis = {
      'UP': '📈 Naik',
      'DOWN': '📉 Turun',
      'STABLE': '➡️ Stabil'
    };

    const embed = new EmbedBuilder()
      .setColor(price.trend === 'UP' ? 0x00ff99 : price.trend === 'DOWN' ? 0xff3300 : 0x00d2ff)
      .setTitle(`📊 Info Harga: ${price.item}`)
      .addFields(
        { name: '💰 Rentang Harga', value: `\`${price.priceRange}\``, inline: true },
        { name: '📊 Tren Pasar', value: trendEmojis[price.trend] || 'Stabil', inline: true },
        { name: '⏱️ Update Terakhir', value: `<t:${Math.floor(price.updatedAt / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `Di-update oleh Staff: ${price.updatedBy}` });

    await interaction.reply({ embeds: [embed] });
  }
};

// =========================================================
// 3. PRICE UPDATE COMMAND (Admin/Staff Only)
// =========================================================
const priceUpdateCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('price-update')
    .setDescription('Update harga barang Growtopia di database (Hanya Staff).')
    .addStringOption(opt => opt.setName('item').setDescription('Nama barang').setRequired(true))
    .addStringOption(opt => opt.setName('price').setDescription('Rentang harga (contoh: 45-50 DL atau 200 Coin)').setRequired(true))
    .addStringOption(opt => opt.setName('trend').setDescription('Tren pasar saat ini').setRequired(true)
      .addChoices(
        { name: '📈 Naik (UP)', value: 'UP' },
        { name: '📉 Turun (DOWN)', value: 'DOWN' },
        { name: '➡️ Stabil (STABLE)', value: 'STABLE' }
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction: ChatInputCommandInteraction) {
    const item = interaction.options.getString('item')!.trim();
    const priceRange = interaction.options.getString('price')!.trim();
    const trend = interaction.options.getString('trend')! as 'UP' | 'DOWN' | 'STABLE';

    const db = loadPrices();
    const key = item.toLowerCase();

    db[key] = {
      item,
      priceRange,
      trend,
      updatedBy: interaction.user.tag,
      updatedAt: Date.now()
    };

    savePrices(db);

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle('✅ Harga Item Berhasil Di-update!')
      .setDescription(`Item **${item}** telah diperbarui di database harga.`)
      .addFields(
        { name: '📦 Item', value: item, inline: true },
        { name: '💰 Rentang Harga Baru', value: `\`${priceRange}\``, inline: true },
        { name: '📈 Tren', value: trend, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

// =========================================================
// 4. TRADE POST COMMAND  (Dropdown Select → Modal)
// =========================================================

/** In-memory sessions: userId → { tipe, buyItems, sellItems } */
const tradeSessions = new Map<string, { tipe: string; buyItems: string[]; sellItems: string[] }>();

/**
 * Parse multi-line item list from modal text.
 * Format per baris: Nama Item | qty | harga
 */
function parseTradeItems(raw: string, guild?: any): string[] {
  return raw.split('\n').map(line => {
    // splits by '|'
    const parts = line.split('|').map(s => s.trim());
    if (parts.length === 0 || !parts[0]) return '';
    const itemName = parts[0];
    const qty = parts.length > 1 ? parts[1] : '';
    const price = parts.length > 2 ? parts[2] : '';

    const emojiName = 'gt_' + itemName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 28).toLowerCase();
    const emoji = guild?.emojis?.cache?.find((e: any) => e.name === emojiName);
    const emojiStr = emoji ? `<:${emoji.name}:${emoji.id}> ` : '• ';

    let out = `${emojiStr}**${itemName}**`;
    if (qty)   out += `  \`x${qty}\``;
    if (price) out += `  — 💰 ${price}`;
    return out;
  }).filter(Boolean);
}

/** Open a modal with items pre-filled so user only edits qty / price */
async function showTradeModal(
  interaction: any,
  tipe: string,
  buyItems: string[],
  sellItems: string[]
) {
  const modal = new ModalBuilder()
    .setCustomId(`trmodal:${tipe}:${interaction.user.id}:${Date.now()}`)
    .setTitle('🏆 Atur Jumlah & Harga Item');

  if (buyItems.length > 0) {
    const prefilled = buyItems.map(item => `${item} | 1 | harga`).join('\n');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('buy_list')
          .setLabel('📥 BELI — edit qty & harga tiap baris')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(prefilled)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  }

  if (sellItems.length > 0) {
    const prefilled = sellItems.map(item => `${item} | 1 | harga`).join('\n');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('sell_list')
          .setLabel('📤 JUAL — edit qty & harga tiap baris')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(prefilled)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  }

  await interaction.showModal(modal);
}



/** Build & send (or update) the trade dropdown message */
export async function sendTradeDropdown(
  interaction: any,
  tipe: string,
  userId: string,
  search: string
) {
  const itemsDb = loadItems();
  const session = tradeSessions.get(userId) ?? { tipe, buyItems: [], sellItems: [] };
  const allKeys = Object.keys(itemsDb);
  const q = search.toLowerCase().trim();

  // Determine search results
  let searchResults = q
    ? allKeys.filter(k => k.includes(q) || (itemsDb[k].item || '').toLowerCase().includes(q))
    : allKeys;

  // We MUST keep previously selected items in the options, otherwise Discord clears them
  const allSelected = Array.from(new Set([...session.buyItems, ...session.sellItems]));
  
  // Remove already selected items from the search results to avoid duplicates
  searchResults = searchResults.filter(k => {
    const label = (itemsDb[k]?.item || k).trim();
    const val = label.substring(0, 100);
    return !allSelected.includes(val);
  });

  // Combine selected items + top search results (max 25 options allowed by Discord)
  const baseOptions: { label: string; value: string }[] = [];
  
  for (const val of allSelected) {
    baseOptions.push({ label: val, value: val });
  }

  for (const key of searchResults) {
    if (baseOptions.length >= 25) break;
    let label = (itemsDb[key].item || key).trim();
    if (label.length > 100) label = label.substring(0, 97) + '...';
    baseOptions.push({ label: label || key, value: label.substring(0, 100) });
  }

  if (baseOptions.length === 0) {
    baseOptions.push({ label: 'Tidak ada hasil — coba kata kunci lain', value: '__none__' });
  }

  const components: ActionRowBuilder<any>[] = [];

  if (tipe === 'buy' || tipe === 'both') {
    const buyOptions = baseOptions.map(opt => ({
      ...opt,
      default: opt.value !== '__none__' && session.buyItems.includes(opt.value)
    }));
    
    const buyMenu = new StringSelectMenuBuilder()
      .setCustomId(`trbuy:${tipe}:${userId}`)
      .setPlaceholder('📥 Pilih item DIBELI — bisa pilih maks 10 sekaligus')
      .setMinValues(1)
      .setMaxValues(Math.min(10, baseOptions.length || 1))
      .addOptions(buyOptions);
      
    if (baseOptions[0].value === '__none__') buyMenu.setDisabled(true);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(buyMenu));
  }

  if (tipe === 'sell' || tipe === 'both') {
    const sellOptions = baseOptions.map(opt => ({
      ...opt,
      default: opt.value !== '__none__' && session.sellItems.includes(opt.value)
    }));

    const sellMenu = new StringSelectMenuBuilder()
      .setCustomId(`trsell:${tipe}:${userId}`)
      .setPlaceholder('📤 Pilih item DIJUAL — bisa pilih maks 10 sekaligus')
      .setMinValues(1)
      .setMaxValues(Math.min(10, baseOptions.length || 1))
      .addOptions(sellOptions);
      
    if (baseOptions[0].value === '__none__') sellMenu.setDisabled(true);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sellMenu));
  }

  // Always: Search button + Lanjut button (all modes)
  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`trsearch:${tipe}:${userId}`)
        .setLabel('🔍 Cari Item')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trconfirm:${userId}`)
        .setLabel('📋 Lanjut → Isi Qty & Harga')
        .setStyle(ButtonStyle.Primary)
    )
  );

  const total = allKeys.length;
  const lines = ['### 🏪 Pilih Item Dagangan'];
  
  if (session.buyItems.length > 0)  lines.push(`✅ **Dibeli**: ${session.buyItems.join(', ')}`);
  if (session.sellItems.length > 0) lines.push(`✅ **Dijual**: ${session.sellItems.join(', ')}`);
  
  const desc = q
    ? `> 🔍 Hasil **"${search}"**: pilih lalu klik **Lanjut**`
    : `> 🔍 **${Math.min(25, total)}** dari **${total.toLocaleString()}** item — klik **🔍 Cari Item** untuk filter`;
    
  lines.push('\n' + desc);

  const payload = {
    content: lines.join('\n'),
    components,
    flags: 64
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(payload).catch(() => interaction.followUp(payload));
  } else if (typeof interaction.update === 'function' && interaction.isButton?.()) {
    await interaction.update(payload);
  } else {
    await interaction.reply(payload);
  }
}

// ---- Select menu handlers ----

export async function handleTradeBuySelect(interaction: any) {
  const [, tipe, userId] = interaction.customId.split(':');
  const session = tradeSessions.get(userId) ?? { tipe, buyItems: [], sellItems: [] };
  session.buyItems = interaction.values.filter((v: string) => v !== '__none__');
  tradeSessions.set(userId, session);

  // Update ONLY content — components (dropdowns + buttons) are preserved by Discord
  const lines = ['### 🏪 Pilih Item Dagangan'];
  if (session.buyItems.length > 0)  lines.push(`✅ **Dibeli**: ${session.buyItems.join(', ')}`);
  if (session.sellItems.length > 0) lines.push(`✅ **Dijual**: ${session.sellItems.join(', ')}`);
  lines.push('\n> Pilih lagi untuk mengganti pilihan, atau klik **📋 Lanjut** saat sudah siap.');

  await interaction.update({ content: lines.join('\n') });
}

export async function handleTradeSellSelect(interaction: any) {
  const [, tipe, userId] = interaction.customId.split(':');
  const session = tradeSessions.get(userId) ?? { tipe, buyItems: [], sellItems: [] };
  session.sellItems = interaction.values.filter((v: string) => v !== '__none__');
  tradeSessions.set(userId, session);

  // Update ONLY content — components (dropdowns + buttons) are preserved by Discord
  const lines = ['### 🏪 Pilih Item Dagangan'];
  if (session.buyItems.length > 0)  lines.push(`✅ **Dibeli**: ${session.buyItems.join(', ')}`);
  if (session.sellItems.length > 0) lines.push(`✅ **Dijual**: ${session.sellItems.join(', ')}`);
  lines.push('\n> Pilih lagi untuk mengganti pilihan, atau klik **📋 Lanjut** saat sudah siap.');

  await interaction.update({ content: lines.join('\n') });
}

export async function handleTradeConfirmBtn(interaction: any) {
  const [, userId] = interaction.customId.split(':');
  const session = tradeSessions.get(userId);
  if (!session || (session.buyItems.length === 0 && session.sellItems.length === 0)) {
    await interaction.reply({ content: '❌ Pilih minimal 1 item dari dropdown terlebih dahulu!', flags: 64 });
    return;
  }
  await showTradeModal(interaction, session.tipe, session.buyItems, session.sellItems);
}

// ---- Search button handler (opens a short search modal) ----

export async function handleTradeSearchBtn(interaction: any) {
  const [, tipe, userId] = interaction.customId.split(':');

  const searchModal = new ModalBuilder()
    .setCustomId(`trsearchmodal:${tipe}:${userId}`)
    .setTitle('🔍 Cari Item');

  searchModal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('search_query')
        .setLabel('Ketik nama item yang ingin dicari')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: Diamond Lock, Angel Wings...')
        .setRequired(false)
        .setMaxLength(50)
    )
  );

  await interaction.showModal(searchModal);
}

// ---- Search modal submit handler (refreshes dropdown with results) ----

export async function handleTradeSearchModal(interaction: any) {
  const [, tipe, userId] = interaction.customId.split(':');
  const query = (interaction.fields.getTextInputValue('search_query') || '').trim();

  // Ensure session still exists
  if (!tradeSessions.has(userId)) {
    tradeSessions.set(userId, { tipe, buyItems: [], sellItems: [] });
  }

  // Defer update so we can edit the original message
  await interaction.deferUpdate();
  await sendTradeDropdown(interaction, tipe, userId, query);
}

// ---- Modal submit handler ----

export async function handleTradeModal(
  interaction: any,
  tradingChannelId: string
) {
  // customId: trmodal:{tipe}:{ownerId}
  const parts = interaction.customId.split(':');
  const tipe    = parts[1];
  const ownerId = parts[2];

  const buyRaw  = ['buy', 'both'].includes(tipe) ? (interaction.fields.getTextInputValue('buy_list') ?? '') : '';
  const sellRaw = ['sell', 'both'].includes(tipe) ? (interaction.fields.getTextInputValue('sell_list') ?? '') : '';

  if (!buyRaw.trim() && !sellRaw.trim()) {
    await interaction.reply({ content: '❌ Form kosong! Harap isi setidaknya satu item.', flags: 64 });
    return;
  }

  const guild = interaction.guild;
  const channel = await guild?.channels.fetch(tradingChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.reply({ content: '❌ Channel trading tidak ditemukan.', flags: 64 });
    return;
  }

  const fields: { name: string; value: string }[] = [
    { name: '👤 Penjual / Trader', value: `${interaction.user.toString()} (${interaction.user.tag})` }
  ];

  if (buyRaw.trim()) {
    fields.push({ name: '📥 Membeli / Buying', value: parseTradeItems(buyRaw, guild).join('\n') });
  }
  if (sellRaw.trim()) {
    fields.push({ name: '📤 Menjual / Selling', value: parseTradeItems(sellRaw, guild).join('\n') });
  }

  const session = tradeSessions.get(ownerId);
  const firstItem = session?.buyItems?.[0] || session?.sellItems?.[0];
  const itemsDb = loadItems();
  let thumbnailUrl = interaction.user.displayAvatarURL({ forceStatic: false });

  if (firstItem) {
    const matchKey = Object.keys(itemsDb).find(k => (itemsDb[k].item || k).trim().substring(0, 100) === firstItem);
    if (matchKey && itemsDb[matchKey].image) {
      thumbnailUrl = itemsDb[matchKey].image;
    }
  }

  const tradeEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🏆 Iklan Dagangan Resmi / Official Trade Offer')
    .setThumbnail(thumbnailUrl)
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'Gunakan tombol di bawah jika produk Anda sudah terjual!' });

  const soldBtn = new ButtonBuilder()
    .setCustomId(`trade-sold_${ownerId}`)
    .setLabel('Tandai Terjual / Mark as Sold')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🤝');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(soldBtn);

  try {
    await (channel as any).send({ embeds: [tradeEmbed], components: [row] });
    tradeCooldowns.set(ownerId, Date.now());
    tradeSessions.delete(ownerId);
    await interaction.reply({ content: `✅ Iklan berhasil diposting di ${channel.toString()}!`, flags: 64 });
  } catch (err) {
    logger.error('Failed to post trade embed from modal:', 'Growtopia');
    await interaction.reply({ content: '❌ Gagal mengirim iklan. Pastikan bot punya izin kirim pesan.', flags: 64 });
  }
}

// =========================================================
// WIKI HELPER FUNCTION (DEEP CRAWLER)
// =========================================================
async function runDeepWikiCrawler(guild: any, logChannelId?: string) {
  let apcontinue: string | undefined = undefined;
  let totalScanned = 0;
  let totalLearned = 0;
  const itemsDb = loadItems();
  const startTime = Date.now();

  logger.info('Deep Wiki Crawler started...', 'Growtopia');

  try {
    do {
      // 1. Fetch batch of titles (200 at a time)
      let url = 'https://growtopia.fandom.com/api.php?action=query&list=allpages&apnamespace=0&aplimit=200&format=json&origin=*';
      if (apcontinue) {
        url += `&apcontinue=${encodeURIComponent(apcontinue)}`;
      }

      const res = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        } 
      });
      const data = (await res.json()) as any;
      
      const pages = data.query?.allpages || [];
      apcontinue = data.continue?.apcontinue;

      if (pages.length === 0) break;

      // 2. Fetch page contents in batches of 50 (Discord API limit per request)
      for (let i = 0; i < pages.length; i += 50) {
        const batch = pages.slice(i, i + 50);
        const titlesParam = batch.map((p: any) => p.title).join('|');

        const contentUrl = `https://growtopia.fandom.com/api.php?action=query&prop=revisions&rvprop=content&titles=${encodeURIComponent(titlesParam)}&format=json&origin=*`;
        const contentRes = await fetch(contentUrl, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
          } 
        });
        const contentData = (await contentRes.json()) as any;

        // Fetch images for this batch
        const imgTitlesParam = batch.map((p: any) => `File:${p.title}.png`).join('|');
        const imgUrl = `https://growtopia.fandom.com/api.php?action=query&titles=${encodeURIComponent(imgTitlesParam)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const imageMap: Record<string, string> = {};
        try {
          const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const imgData = (await imgRes.json()) as any;
          const imgPages = imgData.query?.pages || {};
          for (const pid of Object.keys(imgPages)) {
            if (pid !== '-1' && imgPages[pid].imageinfo?.[0]?.url) {
              const cleanTitle = imgPages[pid].title.replace(/^File:/i, '').replace(/\.png$/i, '').toLowerCase().replace(/_/g, ' ');
              imageMap[cleanTitle] = imgPages[pid].imageinfo[0].url.split('/revision/latest')[0];
            }
          }
        } catch (e) {
          // Ignore image fetch errors for batch
        }

        const pageMap = contentData.query?.pages || {};

        for (const pid of Object.keys(pageMap)) {
          totalScanned++;
          const page = pageMap[pid];
          const pageTitle = page.title;
          const pageContent = page.revisions?.[0]?.['*'] || '';

          // Parse description
          let description = '';
          const itemStartIndex = pageContent.toLowerCase().indexOf('{{item|');
          if (itemStartIndex !== -1) {
            const contentAfterItem = pageContent.substring(itemStartIndex + 7);
            let depth = 0;
            let argIndex = -1;
            for (let j = 0; j < contentAfterItem.length; j++) {
              const char = contentAfterItem[j];
              if (depth === 0 && (char === '|' || (char === '}' && contentAfterItem[j + 1] === '}'))) {
                argIndex = j;
                break;
              }
              if (char === '{' || char === '[') depth++;
              if (char === '}' || char === ']') depth--;
            }

            if (argIndex !== -1) {
              description = contentAfterItem.substring(0, argIndex).trim();
            } else {
              description = contentAfterItem.split('|')[0].trim();
            }

            description = description.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
            description = description.replace(/<!--[\s\S]*?-->/g, '');
            description = description.replace(/\{\{[^}]*\}\}/g, '');

            if (description && description.length > 5 && !description.includes('{{')) {
              const key = pageTitle.toLowerCase();
              const imageUrl = imageMap[key.replace(/_/g, ' ')];
              if (!itemsDb[key]) {
                itemsDb[key] = {
                  item: pageTitle,
                  description: description,
                  image: imageUrl
                };
                totalLearned++;
              } else if (!itemsDb[key].image && imageUrl) {
                // Update missing images for existing items
                itemsDb[key].image = imageUrl;
              }
            }
          }
        }
      }

      // Periodically save database to file
      fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');

      // Add a small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 800));

    } while (apcontinue && totalScanned < 15000); // safety cap at 15k pages

    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    logger.info(`Deep Wiki Crawler completed. Scanned ${totalScanned} pages, learned ${totalLearned} new items. Time: ${elapsedSec}s`, 'Growtopia');

    // Notify staff log channel
    if (logChannelId) {
      const channel = await guild?.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle('🧠 Pembelajaran Menyeluruh Wiki Selesai')
          .setDescription('Bot telah selesai merayapi (crawling) seluruh halaman di Growtopia Fandom Wiki.')
          .addFields(
            { name: '📄 Total Halaman Di-scan', value: `${totalScanned.toLocaleString()}`, inline: true },
            { name: '✨ Item Baru yang Dipelajari', value: `${totalLearned.toLocaleString()}`, inline: true },
            { name: '⏱️ Waktu Pengerjaan', value: `${elapsedSec} detik`, inline: true }
          )
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }

  } catch (error) {
    logger.error('Error during Deep Wiki Crawl:', 'Growtopia');
    logger.error(error as Error);
  }
}

// =========================================================
// WIKI HELPER FUNCTION (IMAGE FETCHER)
// =========================================================
async function runImageFetcher(guild: any, logChannelId?: string) {
  const itemsDb = loadItems();
  const allKeys = Object.keys(itemsDb);
  const keysToFetch = allKeys.filter(k => !itemsDb[k].image);
  const startTime = Date.now();
  let updatedCount = 0;

  logger.info(`Background Image Fetcher started for ${keysToFetch.length} items...`, 'Growtopia');

  if (keysToFetch.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < keysToFetch.length; i += BATCH_SIZE) {
      const batchKeys = keysToFetch.slice(i, i + BATCH_SIZE);
      const titlesParam = batchKeys.map(k => encodeURIComponent(`File:${itemsDb[k].item}.png`)).join('|');
      const url = `https://growtopia.fandom.com/api.php?action=query&titles=${titlesParam}&prop=imageinfo&iiprop=url&format=json&origin=*`;

      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json() as any;
        const pages = data.query?.pages || {};

        for (const pid of Object.keys(pages)) {
          if (pid !== '-1' && pages[pid].imageinfo?.[0]?.url) {
            const rawItemName = pages[pid].title.replace(/^File:/i, '').replace(/\.png$/i, '');
            const matchKey = Object.keys(itemsDb).find(k => itemsDb[k].item.toLowerCase() === rawItemName.toLowerCase().replace(/_/g, ' '));
            if (matchKey) {
              itemsDb[matchKey].image = pages[pid].imageinfo[0].url.split('/revision/latest')[0];
              updatedCount++;
            }
          }
        }

        if (i % (BATCH_SIZE * 4) === 0) {
          fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
        }

        await new Promise(resolve => setTimeout(resolve, 800)); // Respect Fandom rate limit
      } catch (e) {
        logger.error(`Error fetching image batch ${i}:`, 'Growtopia');
      }
    }

    fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
  }

  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  logger.info(`Image Fetcher completed. Found and updated ${updatedCount} images. Time: ${elapsedSec}s`, 'Growtopia');

  if (logChannelId) {
    const channel = await guild?.channels.fetch(logChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle('🖼️ Sinkronisasi Gambar Database Selesai')
        .setDescription(`Bot telah selesai mencari dan mencocokkan gambar untuk **${keysToFetch.length}** item yang belum memiliki gambar (Akurasi >90%).`)
        .addFields(
          { name: '✨ Gambar Berhasil Ditemukan', value: `${updatedCount.toLocaleString()}`, inline: true },
          { name: '⏱️ Waktu Pengerjaan', value: `${elapsedSec} detik`, inline: true }
        )
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    }
  }
}

// =========================================================
// FULL SCAN (1-CLICK: WIKI CRAWL + IMAGE FETCH)
// =========================================================
async function runFullScan(guild: any, logChannelId?: string) {
  const startTime = Date.now();
  logger.info('Full Scan 1-Click started: Phase 1 (Wiki Crawl)...', 'Growtopia');

  // Phase 1: Scrape all items + descriptions + images from wiki
  await runDeepWikiCrawler(guild, undefined);

  logger.info('Full Scan 1-Click: Phase 2 (Image Fetch)...', 'Growtopia');

  // Phase 2: Fill in any missing images
  await runImageFetcher(guild, undefined);

  logger.info('Full Scan 1-Click: Phase 3 (Database Cleanup)...', 'Growtopia');

  // Phase 3: Clean up & optimize database
  const rawDb = loadItems();
  const cleanedDb: ItemsDb = {};
  let cleaned = 0;
  let removed = 0;

  const sortedKeys = Object.keys(rawDb).sort();

  for (const key of sortedKeys) {
    const entry = rawDb[key];
    if (!entry || !entry.item) { removed++; continue; }

    // Clean description
    let desc = (entry.description || '').trim();

    // Remove leftover wiki markup
    desc = desc.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');  // [[link|text]] -> text
    desc = desc.replace(/\{\{[^}]*\}\}/g, '');                    // {{templates}}
    desc = desc.replace(/<[^>]+>/g, '');                          // <html tags>
    desc = desc.replace(/<!--[\s\S]*?-->/g, '');                  // <!-- comments -->
    desc = desc.replace(/'{2,}/g, '');                            // '''bold''' / ''italic''
    desc = desc.replace(/\s{2,}/g, ' ').trim();                   // multiple spaces

    // Skip entries with truly useless data
    if (!desc || desc.length < 3) desc = 'Item Growtopia.';
    if (desc === 'No info.' || desc === 'No info') desc = 'Item Growtopia.';

    // Normalize item name (Title Case)
    const itemName = entry.item.trim();

    // Normalize key (lowercase, trimmed)
    const cleanKey = key.trim().toLowerCase();

    cleanedDb[cleanKey] = {
      item: itemName,
      description: desc,
      image: entry.image || undefined
    };
    cleaned++;
  }

  // Save cleaned & sorted database
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(cleanedDb, null, 2), 'utf-8');

  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const totalItems = Object.keys(cleanedDb).length;
  const withImages = Object.values(cleanedDb).filter(v => v.image).length;
  const accuracy = totalItems > 0 ? Math.round((withImages / totalItems) * 100) : 0;

  logger.info(`Full Scan completed. ${totalItems} items (${removed} removed, ${cleaned} cleaned), ${withImages} with images (${accuracy}%). Time: ${elapsedSec}s`, 'Growtopia');

  // Send combined report
  if (logChannelId) {
    const channel = await guild?.channels.fetch(logChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const minutes = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle('🚀 Full Scan 1-Click Selesai!')
        .setDescription('Bot telah selesai melakukan scraping + optimisasi database secara otomatis.')
        .addFields(
          { name: '📦 Total Item', value: `${totalItems.toLocaleString()}`, inline: true },
          { name: '🖼️ Dengan Gambar', value: `${withImages.toLocaleString()}`, inline: true },
          { name: '📊 Akurasi Gambar', value: `${accuracy}%`, inline: true },
          { name: '🧹 Data Dibersihkan', value: `${cleaned.toLocaleString()}`, inline: true },
          { name: '🗑️ Data Rusak Dihapus', value: `${removed}`, inline: true },
          { name: '⏱️ Waktu Total', value: `${minutes}m ${secs}s`, inline: true },
          { name: '✅ Status Database', value: '```\n• Diurutkan A-Z ✅\n• Deskripsi dibersihkan ✅\n• Wiki markup dihapus ✅\n• Data duplikat dihapus ✅\n• Siap digunakan AI ✅\n```' }
        )
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    }
  }
}

// =========================================================
// WIKI HELPER FUNCTION (SELF-LEARNING)
// =========================================================
async function fetchFromWiki(itemName: string): Promise<ItemData | null> {
  try {
    const searchUrl = `https://growtopia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(itemName)}&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const searchData = await searchResponse.json() as any;
    const pageId = searchData.query?.search?.[0]?.pageid;
    const title = searchData.query?.search?.[0]?.title;

    if (!pageId || !title) return null;

    const contentUrl = `https://growtopia.fandom.com/api.php?action=query&prop=revisions&rvprop=content&pageids=${pageId}&format=json&origin=*`;
    const contentResponse = await fetch(contentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const contentData = await contentResponse.json() as any;
    const pageContent = contentData.query?.pages?.[pageId]?.revisions?.[0]?.['*'] || '';

    let description = 'No description found.';
    const itemStartIndex = pageContent.toLowerCase().indexOf('{{item|');
    if (itemStartIndex !== -1) {
      const contentAfterItem = pageContent.substring(itemStartIndex + 7);
      let depth = 0;
      let argIndex = -1;
      for (let i = 0; i < contentAfterItem.length; i++) {
        const char = contentAfterItem[i];
        if (depth === 0 && (char === '|' || (char === '}' && contentAfterItem[i + 1] === '}'))) {
          argIndex = i;
          break;
        }
        if (char === '{' || char === '[') depth++;
        if (char === '}' || char === ']') depth--;
      }

      if (argIndex !== -1) {
        description = contentAfterItem.substring(0, argIndex).trim();
      } else {
        description = contentAfterItem.split('|')[0].trim();
      }
    } else {
      const sentences = pageContent.replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[[^\]]*\]\]/g, '').trim().split('.');
      if (sentences.length > 0) {
        description = sentences[0] + '.';
      }
    }

    description = description.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
    description = description.replace(/<!--[\s\S]*?-->/g, '');
    description = description.replace(/\{\{[^}]*\}\}/g, '');

    // Fetch Image URL
    let image: string | undefined = undefined;
    const imageUrlReq = `https://growtopia.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(title)}.png&prop=imageinfo&iiprop=url&format=json&origin=*`;
    try {
      const imgRes = await fetch(imageUrlReq, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const imgData = await imgRes.json() as any;
      const pages = imgData.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        if (pid !== '-1' && pages[pid].imageinfo?.[0]?.url) {
          image = pages[pid].imageinfo[0].url.split('/revision/latest')[0];
        }
      }
    } catch (e) {
      // Ignore image fetch errors to not fail the whole command
    }

    return {
      item: title,
      description: description,
      image
    };
  } catch (error) {
    logger.error(`Failed to fetch ${itemName} from wiki:`, 'Growtopia');
    return null;
  }
}

// =========================================================
// 5. ITEM INFO COMMAND
// =========================================================
const itemCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('item')
    .setDescription('Cari informasi detail dan deskripsi resmi item Growtopia.')
    .addStringOption(opt => opt.setName('name').setDescription('Nama item yang ingin dicari').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const itemsDb = loadItems();
    const choices = Object.keys(itemsDb);
    const filtered = choices
      .filter(choice => choice.includes(focusedValue))
      .slice(0, 25);
    await interaction.respond(
      filtered.map(choice => {
        let name = itemsDb[choice].item;
        if (name.length > 100) name = name.substring(0, 97) + '...';
        if (name.length === 0) name = 'Unnamed Item';
        return { name: name, value: name.substring(0, 100) };
      })
    );
  },
  async execute(interaction: ChatInputCommandInteraction) {
    const itemNameInput = interaction.options.getString('name')!.trim().toLowerCase();
    const itemsDb = loadItems();
    const pricesDb = loadPrices();

    let foundKey = Object.keys(itemsDb).find(key => key.toLowerCase() === itemNameInput);
    if (!foundKey) {
      foundKey = Object.keys(itemsDb).find(key => key.toLowerCase().includes(itemNameInput));
    }

    let item: ItemData | null = null;

    if (foundKey) {
      item = itemsDb[foundKey];
    } else {
      // Defer reply since Fandom Wiki fetch is an external HTTP request
      await interaction.deferReply();
      
      const wikiItem = await fetchFromWiki(interaction.options.getString('name')!);
      if (wikiItem) {
        item = wikiItem;
        
        // Cache in local database dynamically!
        itemsDb[wikiItem.item.toLowerCase()] = wikiItem;
        try {
          fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
        } catch (err) {
          logger.error('Failed to cache wiki item in growtopia-items.json', 'Growtopia');
        }
      }
    }

    if (!item) {
      const msg = `❌ Item **"${interaction.options.getString('name')}"** tidak ditemukan di database server maupun Growtopia Wiki.`;
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
      return;
    }

    const priceKey = Object.keys(pricesDb).find(key => key.toLowerCase() === item!.item.toLowerCase() || key.toLowerCase().includes(item!.item.toLowerCase()));
    const price = priceKey ? pricesDb[priceKey] : null;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Purple
      .setTitle(`📦 Info Item: ${item.item}`)
      .setDescription(item.description)
      .setTimestamp();

    if (price) {
      const trendEmojis = {
        'UP': '📈 Naik',
        'DOWN': '📉 Turun',
        'STABLE': '➡️ Stabil'
      };
      embed.addFields(
        { name: '💰 Rentang Harga Server', value: `\`${price.priceRange}\``, inline: true },
        { name: '📈 Tren Pasar', value: trendEmojis[price.trend] || 'Stabil', inline: true }
      );
    } else {
      embed.addFields(
        { name: '💰 Rentang Harga Server', value: 'Belum diatur oleh staff / hubungi admin.', inline: true }
      );
    }

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed] });
    }
  }
};

// =========================================================
// 6. SELF-LEARNING COMMAND (Wiki, News, Chat Scanner)
// =========================================================
const selfLearningCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('self-learning')
    .setDescription('Perintahkan bot untuk mempelajari item, berita, dan info Growtopia dari berbagai sumber.')
    .addStringOption(opt => opt.setName('source').setDescription('Sumber pembelajaran').setRequired(true)
      .addChoices(
        { name: '🚀 Full Scan 1-Click (Item + Gambar)', value: 'full_scan' },
        { name: '📰 Berita Game (Growtopia News)', value: 'news' },
        { name: '🧠 Pembelajaran Massal Wiki (Wiki Bulk Learn)', value: 'wiki_bulk' },
        { name: '🔍 Pemindai Obrolan Server (Chat Trade Scanner)', value: 'trade_scanner' },
        { name: '🖼️ Sinkronisasi Gambar (Image Fetcher)', value: 'fetch_images' }
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction: ChatInputCommandInteraction) {
    const source = interaction.options.getString('source')!;
    const itemsDb = loadItems();

    if (source === 'full_scan') {
      const guildSettings = db.getGuildSettings(interaction.guildId!);
      const logChannelId = guildSettings.modLogChannelId;

      await interaction.reply({
        content: `🚀 **Full Scan 1-Click telah dimulai!**\n\n` +
          `Bot akan melakukan 2 tahap secara otomatis:\n` +
          `**Tahap 1:** 🧠 Scraping seluruh item dari Growtopia Wiki (nama + deskripsi + gambar)\n` +
          `**Tahap 2:** 🖼️ Mencocokkan gambar untuk item yang belum memiliki gambar\n\n` +
          `⏱️ Proses ini berjalan di latar belakang dan membutuhkan beberapa menit.\n` +
          `Laporan lengkap akan dikirimkan ke channel staff log setelah selesai!`,
        ephemeral: true
      });

      // Execute full scan in background
      runFullScan(interaction.guild, logChannelId).catch(err => {
        logger.error('Background full scan failed:', 'Growtopia');
        logger.error(err);
      });
    } else if (source === 'news') {
      await interaction.deferReply();
      try {
        const url = 'https://growtopia.fandom.com/api.php?action=query&list=recentchanges&rcnamespace=0&rclimit=5&format=json&origin=*';
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        const data = await res.json() as any;
        const changes = data.query?.recentchanges || [];

        const embed = new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle('📰 Berita & Pembaruan Terkini Growtopia (Wiki)')
          .setDescription('Berikut adalah halaman/item yang baru-baru ini ditambahkan atau diperbarui di Growtopia Wiki:')
          .setTimestamp();

        if (changes.length > 0) {
          changes.forEach((change: any, idx: number) => {
            embed.addFields({
              name: `${idx + 1}. 📄 ${change.title}`,
              value: `Diperbarui pada: <t:${Math.floor(new Date(change.timestamp).getTime() / 1000)}:R>`,
              inline: false
            });
          });
        } else {
          embed.setDescription('Tidak ada aktivitas pembaruan terbaru yang ditemukan.');
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching recent wiki changes:', 'Growtopia');
        await interaction.editReply('❌ Gagal mengambil berita pembaruan terbaru dari Wiki.');
      }
    } else if (source === 'wiki_bulk') {
      const guildSettings = db.getGuildSettings(interaction.guildId!);
      const logChannelId = guildSettings.modLogChannelId;

      await interaction.reply({
        content: `🚀 **Pembelajaran Menyeluruh (Deep Wiki Learning) telah dimulai di latar belakang!**\n` +
          `Bot sedang merayapi seluruh halaman di Growtopia Wiki secara massal. Proses ini aman dan efisien, namun membutuhkan waktu beberapa menit.\n` +
          `Laporan hasil scan lengkap akan dikirimkan ke channel staff log setelah selesai!`,
        ephemeral: true
      });

      // Execute background crawler
      runDeepWikiCrawler(interaction.guild, logChannelId).catch(err => {
        logger.error('Background wiki crawl failed:', 'Growtopia');
        logger.error(err);
      });
    } else if (source === 'trade_scanner') {
      await interaction.deferReply();
      try {
        const tradingChannelId = '1419848898293268488'; // #🏆〡growtopia-trading
        const channel = await interaction.guild?.channels.fetch(tradingChannelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
          await interaction.editReply('❌ Channel trading `#🏆〡growtopia-trading` tidak ditemukan di server ini.');
          return;
        }

        const messages = await (channel as any).messages.fetch({ limit: 50 });
        const allWords: string[] = [];

        messages.forEach((msg: any) => {
          const words = msg.content
            .toLowerCase()
            .replace(/[^\w\s']/g, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 2);
          
          allWords.push(...words);
        });

        const stopWords = new Set(['buy', 'sell', 'wtb', 'wts', 'for', 'and', 'the', 'dls', 'coins', 'bgl', 'bgls', 'dls', 'coins', 'with', 'offer', 'price', 'fast', 'deal', 'stock', 'msg']);
        const candidates = allWords.filter(w => !stopWords.has(w));

        const freq: Record<string, number> = {};
        candidates.forEach(w => {
          freq[w] = (freq[w] || 0) + 1;
        });

        const sortedCandidates = Object.keys(freq)
          .sort((a, b) => freq[b] - freq[a])
          .slice(0, 10);

        const learnedItems: string[] = [];

        for (const candidate of sortedCandidates) {
          const exists = Object.keys(itemsDb).some(k => k === candidate || k.includes(candidate));
          if (!exists) {
            const cached = await fetchFromWiki(candidate);
            if (cached) {
              itemsDb[cached.item.toLowerCase()] = cached;
              learnedItems.push(cached.item);
            }
          }
        }

        if (learnedItems.length > 0) {
          fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
        }

        const embed = new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle('🔍 Hasil Pemindaian Chat Trading')
          .setDescription('Bot memindai 50 pesan obrolan trading terbaru untuk mencari kata kunci item yang sering disebut oleh member.')
          .addFields(
            { name: '📊 Kata kunci yang paling sering dibahas:', value: sortedCandidates.map(w => `• \`${w}\` (${freq[w]} kali)`).join('\n') || 'Tidak ada kata kunci yang menonjol.' },
            { name: '🧠 Item baru yang dipelajari dan ditambahkan ke database:', value: learnedItems.length > 0 ? learnedItems.map(item => `• ${item}`).join('\n') : 'Semua item yang disebutkan sudah terdaftar di database server.' }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error during chat scan learning:', 'Growtopia');
        await interaction.editReply('❌ Gagal memindai obrolan trading server.');
      }
    } else if (source === 'fetch_images') {
      const guildSettings = db.getGuildSettings(interaction.guildId!);
      const logChannelId = guildSettings.modLogChannelId;

      await interaction.reply({
        content: `🚀 **Proses Pencarian Gambar (Image Fetching) 1-Click telah dimulai!**\n` +
          `Bot akan secara perlahan menyinkronkan gambar untuk seluruh item di database agar memiliki akurasi di atas 90%. Proses ini berjalan di latar belakang.\n` +
          `Laporan hasil scan lengkap akan dikirimkan ke channel staff log setelah selesai!`,
        ephemeral: true
      });

      // Execute background image fetcher
      runImageFetcher(interaction.guild, logChannelId).catch(err => {
        logger.error('Background image fetch failed:', 'Growtopia');
        logger.error(err);
      });
    }
  }
};

// =========================================================
// 7. SYNC EMOJIS COMMAND
// =========================================================
const popularItemsToEmoji = [
  "Dirt", "Lava", "World Lock", "Diamond Lock", "Blue Gem Lock", "Black Gem Lock",
  "Robotic Buff", "Rayman's Fist", "Magplant 5000", "Gnome", "Angelic Halo", "Devil Wings",
  "Phoenix Wings", "Golden Pickaxe", "Focus Eyes", "Mini You", "Zeus' Lightning Bolt",
  "Growboard", "Vampire Cape", "Frankenstein", "Mummy", "Cultist Hood", "Cultist Robe",
  "Blanket", "Water Bucket", "Cave Dirt", "Bedrock", "Main Door", "Geminus",
  "Riding Raptor", "Riding Wolf", "Golden Apple", "Pineapple", "Blueberry",
  "Crystal Block", "Neon Glowstick", "Laser Grid", "Pepper Tree", "Chandelier",
  "Sorcerer", "Wizard Hat", "Golden Angel Wings", "Draconic Wings", "Fairy Wings",
  "Pegasus", "Unicorn", "Rainbow Wings", "Dark Magic Pendragon", "Light Magic Pendragon",
  "Pet Hatchley"
];

function formatEmojiName(itemName: string): string {
  return 'gt_' + itemName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 28).toLowerCase();
}

const syncEmojisCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sync-emojis')
    .setDescription('Sinkronisasi gambar item populer menjadi emoji server (Admin Only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const itemsDb = loadItems();
    const guild = interaction.guild!;
    
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const itemName of popularItemsToEmoji) {
      const emojiName = formatEmojiName(itemName);
      
      const existing = guild.emojis.cache.find(e => e.name === emojiName);
      if (existing) {
        skipped++;
        continue;
      }

      const key = Object.keys(itemsDb).find(k => itemsDb[k].item.toLowerCase() === itemName.toLowerCase());
      if (!key || !itemsDb[key].image) {
        failed++;
        continue;
      }

      try {
        const res = await fetch(itemsDb[key].image!);
        const buffer = Buffer.from(await res.arrayBuffer());
        await guild.emojis.create({ attachment: buffer, name: emojiName });
        added++;
        await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit protection
      } catch (e) {
        logger.error(`Gagal upload emoji ${emojiName}`);
        failed++;
      }
    }

    await interaction.editReply(`✅ **Sinkronisasi Emoji Selesai!**\nDitambahkan: ${added}\nDiabaikan (Sudah ada): ${skipped}\nGagal (Tidak ada gambar/Error): ${failed}\n\nSekarang item-item populer akan memiliki icon di menu trade!`);
  }
};

// =========================================================
// 8. REMOVE EMOJIS COMMAND
// =========================================================
const removeEmojisCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('remove-emojis')
    .setDescription('Hapus semua custom emoji item yang dibuat oleh bot (Admin Only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const guild = interaction.guild!;
    const botEmojis = guild.emojis.cache.filter(e => e.name && e.name.startsWith('gt_'));

    if (botEmojis.size === 0) {
      await interaction.editReply('❌ Tidak ada custom emoji bot (awalan `gt_`) yang ditemukan di server ini.');
      return;
    }

    let deleted = 0;
    let failed = 0;

    for (const emoji of botEmojis.values()) {
      try {
        await emoji.delete('Requested via /remove-emojis command');
        deleted++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit protection
      } catch (e) {
        logger.error(`Gagal menghapus emoji ${emoji.name}`);
        failed++;
      }
    }

    await interaction.editReply(`✅ **Penghapusan Emoji Selesai!**\nBerhasil dihapus: ${deleted}\nGagal: ${failed}`);
  }
};

// =========================================================
// 9. ITEM GALLERY COMMAND (View items with images)
// =========================================================
const itemGalleryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('item-gallery')
    .setDescription('Lihat daftar item yang sudah memiliki gambar di database.')
    .addIntegerOption(opt => opt.setName('halaman').setDescription('Nomor halaman (1 halaman = 20 item)').setMinValue(1))
    .addStringOption(opt => opt.setName('cari').setDescription('Filter berdasarkan nama item')),
  async execute(interaction: ChatInputCommandInteraction) {
    const itemsDb = loadItems();
    const searchQuery = interaction.options.getString('cari')?.toLowerCase() || '';
    const page = (interaction.options.getInteger('halaman') || 1) - 1;
    const perPage = 20;

    // Filter items that have images
    let itemsWithImages = Object.values(itemsDb).filter(item => item.image);

    // Apply search filter if provided
    if (searchQuery) {
      itemsWithImages = itemsWithImages.filter(item =>
        item.item.toLowerCase().includes(searchQuery)
      );
    }

    const totalItems = itemsWithImages.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * perPage;
    const pageItems = itemsWithImages.slice(start, start + perPage);

    const totalInDb = Object.keys(itemsDb).length;
    const totalWithImg = Object.values(itemsDb).filter(v => v.image).length;

    const list = pageItems.map((item, idx) => {
      return `**${start + idx + 1}.** ${item.item}`;
    }).join('\n') || 'Tidak ada item ditemukan.';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🖼️ Item Gallery — Daftar Item Bergambar')
      .setDescription(list)
      .addFields(
        { name: '📊 Statistik Database', value: `${totalWithImg.toLocaleString()} / ${totalInDb.toLocaleString()} item memiliki gambar (${Math.round((totalWithImg/totalInDb)*100)}%)`, inline: false }
      )
      .setFooter({ text: `Halaman ${safePage + 1} dari ${totalPages}${searchQuery ? ` | Filter: "${searchQuery}"` : ''} | Gunakan /item-gallery halaman:2 untuk halaman berikutnya` })
      .setTimestamp();

    // Show thumbnail of first item on this page
    if (pageItems.length > 0 && pageItems[0].image) {
      embed.setThumbnail(pageItems[0].image);
    }

    await interaction.reply({ embeds: [embed] });
  }
};

// =========================================================
// 10. SIMULATE CHAT COMMAND
// =========================================================
const simulateChatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gt-chat')
    .setDescription('Kontrol Multi-Agent AI Simulation di channel ini.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt
      .setName('action')
      .setDescription('Mulai atau Hentikan simulasi')
      .setRequired(true)
      .addChoices(
        { name: 'Start', value: 'start' },
        { name: 'Stop', value: 'stop' }
      )),
  async execute(interaction: ChatInputCommandInteraction) {
    const action = interaction.options.getString('action');
    const channelId = interaction.channelId;

    if (action === 'start') {
      await interaction.deferReply();
      if (isSimulationRunning(channelId)) {
        await interaction.editReply({ content: '❌ Simulasi sudah berjalan di channel ini!' });
        return;
      }
      
      const success = startSimulation(interaction.client, channelId);
      if (success) {
        await interaction.editReply({ content: '✅ **Multi-Agent Simulation (Growtopia Chat)** berhasil dimulai! AI akan segera ngobrol di channel ini.' });
      } else {
        await interaction.editReply({ content: '❌ Gagal memulai simulasi.' });
      }
    } else if (action === 'stop') {
      await interaction.deferReply();
      if (!isSimulationRunning(channelId)) {
        await interaction.editReply({ content: '❌ Tidak ada simulasi yang berjalan di channel ini.' });
        return;
      }

      const success = stopSimulation(channelId);
      if (success) {
        await interaction.editReply({ content: '🛑 **Simulasi dihentikan.** AI berhenti mengobrol.' });
      } else {
        await interaction.editReply({ content: '❌ Gagal menghentikan simulasi.' });
      }
    }
  }
};

export const growtopiaCommands = [convertCommand, syncEmojisCommand, removeEmojisCommand, simulateChatCommand];
