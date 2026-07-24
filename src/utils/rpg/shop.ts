import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { COLORS, fmt } from './ui';

// ============================================================
// ITEM CATALOG
// ============================================================
export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  price: number;
  priceUnit: 'gems' | 'coins' | 'dls' | 'bloodstones' | 'migrationTokens';
  category: 'currency' | 'consumable' | 'economy' | 'weapon' | 'event';
  maxStack?: number;
}

export const SHOP_CATALOG: ShopItem[] = [
  // ── Currency Exchange ──
  { id: 'wl',        name: 'World Lock',       emoji: '🔒', category: 'currency',   price: 2000, priceUnit: 'gems', desc: 'Mata uang premium dunia. 1 Coin = 2.000 Gems.' },
  { id: `dl`,        name: `Diamond Lock`,     emoji: `${EMOJIS.res_mystic}`, category: `currency`,   price: 100,  priceUnit: `coins`,  desc: `Mata uang kelas tinggi. 1 DL = 100 Coin.` },
  { id: 'bgl',       name: 'Blue Gem Lock',    emoji: '🔵', category: 'currency',   price: 100,  priceUnit: 'dls',  desc: 'Mata uang tertinggi. 1 BGL = 100 DL.' },

  // ── Consumables ──
  { id: 'medkit',    name: 'Medkit',           emoji: '💉', category: 'consumable', price: 2,    priceUnit: 'coins',  desc: 'Pulihkan HP penuh di medan perang dengan !heal. Beli banyak sebelum masuk dungeon!' },

  // ── Economy / Properti ──
  // NOTE: Tanah & Pekerja dipindahkan ke !menu → 🏡 Kota (Town System)
  { id: 'livestock', name: 'Hewan Ternak',     emoji: '🐄', category: 'economy',    price: 30,   priceUnit: 'coins',  desc: 'Secara pasif memulihkan 1 HP per menit saat kamu offline.' },

  // ── Weapon Upgrade ──
  { id: `weapon`,    name: `Upgrade Senjata`,  emoji: `${EMOJIS.unit_infantry}`, category: `weapon`,     price: -1,   priceUnit: `coins`,  desc: `Upgrade legacy weapon ke tier berikutnya. Harga naik per level.` },
  { id: `pickaxe`,   name: `Upgrade Pickaxe`,  emoji: `${EMOJIS.res_iron}`, category: `weapon`,     price: 10,   priceUnit: `coins`,  desc: `Tingkatkan efisiensi farming. Lv.1→2 = 10 Coin, dst.` },

  // ── EVENT (Blood Moon & Swarm) ──
  { id: 'bloodpot',  name: 'Blood Potion',     emoji: '🍷', category: 'event',      price: 3,    priceUnit: 'bloodstones',  desc: 'Memulihkan HP penuh. (+1000 HP)', maxStack: 99 },
  { id: 'bloodtkn',  name: 'Blood Moon Token', emoji: '🎟️', category: 'event',      price: 20,   priceUnit: 'bloodstones',  desc: 'Token khusus untuk menarik Gacha eksklusif.' },
  { id: 'bloodscy',  name: 'Vampiric Scythe',  emoji: '🧛', category: 'event',      price: 150,  priceUnit: 'bloodstones',  desc: 'Senjata legendaris Blood Moon! Lifesteal pasif.' },
  { id: 'mystic-wood', name: 'Mystic Wood',    emoji: '🌳', category: 'event',      price: 5,    priceUnit: 'migrationTokens', desc: 'Material untuk membangun Zoo.' },
  { id: 'golden-net',  name: 'Golden Net',     emoji: '✨', category: 'event',      price: 100,  priceUnit: 'migrationTokens', desc: 'Meningkatkan kesuksesan menangkap hewan (Kosmetik).' },
];

const CATEGORY_META: Record<string, { emoji: string; title: string; lore: string }> = {
  currency:   { emoji: '💱', title: 'CURRENCY EXCHANGE',  lore: 'Tukar mata uangmu di sini.' },
  consumable: { emoji: '🧪', title: 'APOTEK & SUPPLIES',  lore: 'Perlengkapan bertahan hidup untuk petualang.' },
  economy:    { emoji: '🏘️', title: 'TERNAK & LAINNYA',   lore: 'Item ekonomi. Untuk Tanah & Rekrut Pekerja, gunakan !menu → 🏡 Kota.' },
  weapon:     { emoji: `${EMOJIS.unit_infantry}`, title: `SENJATA & UPGRADE`,  lore: `Tingkatkan kekuatan tempurmu.` },
  event:      { emoji: '🩸', title: 'BLOOD MOON EVENT',   lore: 'Tukarkan Bloodstone-mu di sini selama akhir pekan!' },
};

// ============================================================
// SHOP MAIN MENU (Clickable Buttons!)
// ============================================================
export function handleShopMenu(db: MinigameDB, player: PlayerInventory): { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } {
  const categories = ['currency', 'consumable', 'economy', 'weapon', 'event'] as const;

  const categoryFields = categories.map(cat => {
    const meta = CATEGORY_META[cat];
    const items = SHOP_CATALOG.filter(i => i.category === cat);
    const preview = items.slice(0, 3).map(i => `${i.emoji} ${i.name}`).join('  •  ');
    return {
      name: `${meta.emoji}  ${meta.title}`,
      value: `*${meta.lore}*\n${preview}${items.length > 3 ? ' ...' : ''}`,
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.SHOP)
    .setTitle('🛒  MARCUS\'S EMPORIUM  🛒')
    .setDescription(
      `*Kamu memasuki toko. Bau kayu dan perkamen tua memenuhi udara. Merchant tua menyambut dengan senyum lebar.*\n\n` +
      `> *"Selamat datang, Sobat Petualang! Semua yang kamu butuhkan ada di sini. Tinggal pilih dan bayar!"*\n\n` +
      `\`\`\`\n` +
      ` ╔══════════════════════════════╗\n` +
      ` ║    🛒  MARCUS'S EMPORIUM     ║\n` +
      ` ║  "We sell quality, not junk" ║\n` +
      ` ╚══════════════════════════════╝\n` +
      `\`\`\``
    )
    .addFields(
      ...categoryFields,
      {
        name: '💰  Kantongmu Sekarang',
        value: `💠 **${fmt(player.gems)}** Gems  •  🔒 **${player.coins}** Coin  •  ${EMOJIS.res_mystic} **${0}** DL  •  🔵 **${0}** BGL` + ((player.eventBloodstones||0) > 0 ? `  •  🩸 **${player.eventBloodstones}** Bloodstone` : ''),
        inline: false,
      }
    )
    .setFooter({ text: 'Klik tombol di bawah untuk membuka kategori shop!' })
    .setTimestamp();

  // Create Interactive Buttons
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('shopcat_currency').setLabel('Currency').setEmoji('💱').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_consumable').setLabel('Supplies').setEmoji('🧪').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_economy').setLabel('Economy').setEmoji('🏘️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_legacy').setLabel('Upgrades').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shopcat_event').setLabel('Event').setEmoji('🩸').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1] };
}

// ============================================================
// SHOP CATEGORY PAGE
// ============================================================
export function handleShopCategory(db: MinigameDB, player: PlayerInventory, cat: string): { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } {
  let realCat = cat;
  if (cat === 'legacy') realCat = 'weapon'; // legacy uses 'weapon' key internally

  const meta = CATEGORY_META[realCat];
  if (!meta) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❓  Kategori Tidak Ditemukan')
      .setDescription(`Kategori tersedia: \`currency\`, \`consumable\`, \`economy\`, \`weapon\`\nKetik \`!shop\` untuk melihat semua.`);
    return { embeds: [embed], components: [] };
  }

  const items = SHOP_CATALOG.filter(i => i.category === realCat);

  const itemFields = items.map(item => {
    let priceStr: string;
    if (item.id === 'weapon') {
      priceStr = `${player.weaponLevel * 15} Coin`;
    } else if (item.priceUnit === 'gems') {
      priceStr = `${fmt(item.price)} Gems`;
    } else if (item.priceUnit === 'coins') {
      priceStr = `${item.price} Coin`;
    } else if (item.priceUnit === 'bloodstones') {
      priceStr = `${item.price} Bloodstones`;
    } else if (item.priceUnit === 'migrationTokens') {
      priceStr = `${item.price} Migration Tokens`;
    } else {
      priceStr = `${item.price} DL`;
    }
    return {
      name: `${item.emoji}  ${item.name}  —  *${priceStr}*`,
      value: item.desc,
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.SHOP)
    .setTitle(`${meta.emoji}  ${meta.title}`)
    .setDescription(`*${meta.lore}*\n\n> *"Barang terbaik yang bisa kamu temukan di kota ini!"* — Marcus`)
    .addFields(
      ...itemFields,
      {
        name: '💰  Kantongmu',
        value: `💠 **${fmt(player.gems)}** Gems  •  🔒 **${player.coins}** Coin  •  ${EMOJIS.res_mystic} **${0}** DL`,
        inline: false,
      }
    )
    .setFooter({ text: 'Klik tombol di bawah untuk membeli item secara instan!' });

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (cat === 'currency') {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopbuy_wl_1').setLabel('Beli 1 Coin').setEmoji('🔒').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_wl_10').setLabel('Beli 10 Coin').setEmoji('🔒').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_wl_max').setLabel('Beli Max Coin').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopbuy_dl_1`).setLabel(`Beli 1 DL`).setEmoji(`${EMOJIS.res_mystic}`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_bgl_1').setLabel('Beli 1 BGL').setEmoji('🔵').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    components.push(row1, row2);
  } else if (cat === 'consumable') {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopbuy_medkit_1').setLabel('Beli 1 Medkit').setEmoji('💉').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_medkit_5').setLabel('Beli 5 Medkit').setEmoji('💉').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_medkit_10').setLabel('Beli 10 Medkit').setEmoji('💉').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    components.push(row1);
  } else if (cat === 'economy') {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopbuy_livestock_1').setLabel('Beli 1 Ternak').setEmoji('🐄').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali ke Shop').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    // Hint row
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dash_town').setLabel('Ke Menu Kota (Tanah & Pekerja)').setEmoji('🏡').setStyle(ButtonStyle.Primary)
    );
    components.push(row1, row2);
  } else if (cat === 'event') {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopbuy_bloodpot_1').setLabel('Beli Potion').setEmoji('🍷').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_bloodtkn_1').setLabel('Beli Token').setEmoji('🎟️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopbuy_bloodscy_1').setLabel('Beli Scythe').setEmoji('🧛').setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopbuy_mysticwood_1').setLabel('Beli Mystic Wood').setEmoji('🌳').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('shopbuy_goldennet_1').setLabel('Beli Golden Net').setEmoji('✨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    components.push(row1, row2);
  } else {
    // legacy weapons / pickaxe upgrades
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopbuy_legacy_weapon`).setLabel(`Upgrade Senjata`).setEmoji(`${EMOJIS.unit_infantry}`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`shopbuy_legacy_pickaxe`).setLabel(`Upgrade Pickaxe`).setEmoji(`${EMOJIS.res_iron}`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    );
    components.push(row1);
  }

  return { embeds: [embed], components };
}

// ============================================================
// SHOP BUY (delegates to minigame buy() but wraps in embed)
// ============================================================
export function buildShopBuyEmbed(result: string, success: boolean, player: PlayerInventory): { embeds: EmbedBuilder[] } {
  const embed = new EmbedBuilder()
    .setColor(success ? COLORS.SUCCESS : COLORS.BANK_WARN)
    .setTitle(success ? '🛍️  Transaksi Berhasil!' : '❌  Transaksi Gagal')
    .setDescription(result)
    .addFields({
      name: '💰  Sisa Kantong',
      value: `💠 **${fmt(player.gems)}** Gems  •  🔒 **${player.coins}** Coin`,
      inline: false,
    })
    .setTimestamp();
  return { embeds: [embed] };
}
