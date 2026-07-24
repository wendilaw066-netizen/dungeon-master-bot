import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { COLORS, fmt } from './ui';

const AUCTION_DB_PATH = path.join(__dirname, '..', '..', '..', 'auction_db.json');

export interface AuctionItem {
  id: string; // 4 char hex
  sellerId: string;
  sellerName: string;
  itemName: string;
  price: number; // in Coins
  timestamp: number;
}

export interface AuctionDB {
  items: AuctionItem[];
  pendingProfits: Record<string, number>; // Maps sellerId to Coins earned while offline
}

let memoryDB: AuctionDB | null = null;

export function loadAuctionDB(): AuctionDB {
  if (memoryDB) return memoryDB;
  if (!fs.existsSync(AUCTION_DB_PATH)) {
    const defaultDB: AuctionDB = { items: [], pendingProfits: {} };
    fs.writeFileSync(AUCTION_DB_PATH, JSON.stringify(defaultDB, null, 2));
    memoryDB = defaultDB;
    return defaultDB;
  }
  memoryDB = JSON.parse(fs.readFileSync(AUCTION_DB_PATH, 'utf-8'));
  return memoryDB!;
}

let auctionSaveTimeout: NodeJS.Timeout | null = null;
export function saveAuctionDB(db: AuctionDB) {
  memoryDB = db;
  if (!auctionSaveTimeout) {
    auctionSaveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(AUCTION_DB_PATH, JSON.stringify(memoryDB, null, 2));
      } catch (err) {}
      auctionSaveTimeout = null;
    }, 3000);
  }
}

function generateShortId(): string {
  return Math.random().toString(16).substring(2, 6);
}

export function claimAuctionProfits(db: MinigameDB, player: PlayerInventory, playerId: string): string | null {
  const adb = loadAuctionDB();
  if (adb.pendingProfits[playerId] && adb.pendingProfits[playerId] > 0) {
    const profit = adb.pendingProfits[playerId];
    player.coins += profit;
    adb.pendingProfits[playerId] = 0;
    saveMinigameDB(db);
    saveAuctionDB(adb);
    return `💵 Seseorang telah membeli barang lelangmu saat kamu sedang pergi! Kamu mendapatkan **${profit} Coin**!`;
  }
  return null;
}

export function handleAuction(db: MinigameDB, player: PlayerInventory, playerId: string, playerName: string, args: string[]): { embeds: EmbedBuilder[] } {
  const adb = loadAuctionDB();
  const subcmd = (args[0] || '').toLowerCase();
  
  let profitMsg = '';
  if (adb.pendingProfits[playerId] && adb.pendingProfits[playerId] > 0) {
    const profit = adb.pendingProfits[playerId];
    player.coins += profit;
    adb.pendingProfits[playerId] = 0;
    saveMinigameDB(db);
    saveAuctionDB(adb);
    profitMsg = `\n\n💵 Seseorang telah membeli barang lelangmu saat kamu sedang pergi! Kamu mendapatkan **${profit} Coin**!`;
  }
  
  if (subcmd === 'sell') {
    // !auction sell <price_in_wl> <item_name>
    // e.g. !auction sell 25 angel wings
    const priceStr = args[1];
    const price = parseInt(priceStr);
    
    if (isNaN(price) || price <= 0) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Format salah. Contoh: `!auction sell 25 angel wings`' + profitMsg)] };
    }
    
    const itemName = args.slice(2).join(' ').toLowerCase();
    if (!itemName) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Masukkan nama item! Contoh: `!auction sell 25 angel wings`' + profitMsg)] };
    }
    
    // Check if player has the item in items or gtItems
    let itemFound = false;
    let isGt = false;
    let exactName = '';
    
    const itemIndex = player.items.findIndex(i => i.toLowerCase() === itemName);
    if (itemIndex !== -1) {
      itemFound = true;
      exactName = player.items[itemIndex];
      player.items.splice(itemIndex, 1);
    } else if (player.gtItems) {
      const gtIndex = player.gtItems.findIndex(i => i.toLowerCase() === itemName);
      if (gtIndex !== -1) {
        itemFound = true;
        isGt = true;
        exactName = player.gtItems[gtIndex];
        player.gtItems.splice(gtIndex, 1);
      }
    }
    
    if (!itemFound) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Kamu tidak memiliki **${itemName}** di kantongmu!` + profitMsg)] };
    }
    
    const auctionId = generateShortId();
    adb.items.push({
      id: auctionId,
      sellerId: playerId,
      sellerName: playerName,
      itemName: exactName,
      price: price,
      timestamp: Date.now()
    });
    
    saveMinigameDB(db);
    saveAuctionDB(adb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`✅ Kamu berhasil memasang **${exactName}** di Auction House dengan harga **${price} Coin**.\nID Lelang: \`${auctionId}\`` + profitMsg)] };
  } 
  
  else if (subcmd === 'view' || subcmd === 'list') {
    if (adb.items.length === 0) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('⚖️ Global Auction House').setDescription('Saat ini tidak ada barang yang dilelang.' + profitMsg)] };
    }
    
    // Sort by timestamp newest
    const sorted = adb.items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
    let desc = 'Gunakan `!auction buy <ID>` untuk membeli barang.\n\n';
    
    for (const item of sorted) {
      desc += `\`[ID: ${item.id}]\` **${item.itemName}** — 💰 **${item.price} Coin** *(Seller: ${item.sellerName})*\n`;
    }
    
    if (adb.items.length > 15) {
      desc += `\n*...dan ${adb.items.length - 15} barang lainnya.*`;
    }
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('⚖️ Global Auction House').setDescription(desc + profitMsg)] };
  }
  
  else if (subcmd === 'buy') {
    const auctionId = (args[1] || '').toLowerCase();
    if (!auctionId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Masukkan ID lelang. Contoh: `!auction buy a1b2`' + profitMsg)] };
    }
    
    const itemIndex = adb.items.findIndex(i => i.id === auctionId);
    if (itemIndex === -1) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Barang dengan ID **${auctionId}** tidak ditemukan (mungkin sudah terjual atau ditarik).` + profitMsg)] };
    }
    
    const item = adb.items[itemIndex];
    
    if (item.sellerId === playerId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu tidak bisa membeli barangmu sendiri! Gunakan `!auction cancel <id>` jika ingin menariknya.' + profitMsg)] };
    }
    
    if (player.coins < item.price) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`Uangmu tidak cukup! Barang ini harganya **${item.price} Coin**, uangmu cuma **${player.coins} Coin**.` + profitMsg)] };
    }
    
    // Process transaction
    player.coins -= item.price;
    player.items.push(item.itemName);
    
    // Give money to seller (offline or online)
    const seller = getPlayer(db, item.sellerId);
    if (!adb.pendingProfits[item.sellerId]) adb.pendingProfits[item.sellerId] = 0;
    adb.pendingProfits[item.sellerId] += item.price;
    
    // Remove from market
    adb.items.splice(itemIndex, 1);
    
    saveMinigameDB(db);
    saveAuctionDB(adb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`✅ Kamu berhasil membeli **${item.itemName}** seharga **${item.price} Coin** dari ${item.sellerName}!` + profitMsg)] };
  }
  
  else if (subcmd === 'cancel') {
    const auctionId = (args[1] || '').toLowerCase();
    if (!auctionId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Masukkan ID lelang. Contoh: `!auction cancel a1b2`' + profitMsg)] };
    }
    
    const itemIndex = adb.items.findIndex(i => i.id === auctionId);
    if (itemIndex === -1) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Barang tidak ditemukan.' + profitMsg)] };
    }
    
    const item = adb.items[itemIndex];
    if (item.sellerId !== playerId) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Ini bukan barang milikmu!' + profitMsg)] };
    }
    
    player.items.push(item.itemName);
    adb.items.splice(itemIndex, 1);
    
    saveMinigameDB(db);
    saveAuctionDB(adb);
    
    return { embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`✅ Kamu telah menarik **${item.itemName}** dari Auction House dan mengembalikannya ke kantongmu.` + profitMsg)] };
  }
  
  // Default help
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('⚖️ Global Auction House')
    .setDescription('Tempat jual beli antar pemain secara bebas. Barang tetap dijual meskipun kamu sedang offline!' + profitMsg)
    .addFields(
      { name: '🛒 Perintah', value: '`!auction view` - Lihat barang yang dijual\n`!auction sell <harga_wl> <nama_barang>` - Jual barang\n`!auction buy <ID>` - Beli barang\n`!auction cancel <ID>` - Tarik barangmu dari pasar' }
    );
    
  const { getCashflowField } = require('./town');
  embed.addFields(getCashflowField(player));
  return { embeds: [embed] };
}
