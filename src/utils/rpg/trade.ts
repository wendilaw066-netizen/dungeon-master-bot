import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';

// ============================================================
// TRADE SESSION STATE MACHINE
// ============================================================
interface TradeOffer {
  coins: number;
  gems: number;
  item: string | null; // item name from inventory
  confirmed: boolean;
}

interface TradeSession {
  channelId: string;
  player1Id: string;
  player2Id: string;
  offers: {
    [playerId: string]: TradeOffer;
  };
  createdAt: number; // timestamp for auto-expiry
}

// In-memory session store (keyed by channelId)
const activeTrades = new Map<string, TradeSession>();

const TRADE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes auto-cancel

// ============================================================
// HELPERS
// ============================================================
function emptyOffer(): TradeOffer {
  return { coins: 0, gems: 0, item: null, confirmed: false };
}

function formatOffer(offer: TradeOffer, label: string): string {
  const parts: string[] = [];
  if (offer.coins > 0) parts.push(`${offer.coins} Coin`);
  if (offer.gems > 0) parts.push(`${offer.gems} Gems`);
  if (offer.item) parts.push(`Item: **${offer.item}**`);
  const content = parts.length > 0 ? parts.join(', ') : '*Belum ada penawaran*';
  const status = offer.confirmed ? '✅ Setuju' : '⏳ Menunggu...';
  return `**${label}:** ${content} — ${status}`;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [channelId, session] of activeTrades.entries()) {
    if (now - session.createdAt > TRADE_EXPIRY_MS) {
      activeTrades.delete(channelId);
    }
  }
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

/** !trade @user — Inisiasi sesi perdagangan */
export function handleTradeInit(
  channelId: string,
  initiatorId: string,
  initiatorName: string,
  targetId: string,
  targetName: string
): string {
  cleanExpiredSessions();

  if (initiatorId === targetId) return `❌ Kamu nggak bisa dagang sama diri sendiri, bos!`;

  if (activeTrades.has(channelId)) {
    return `⚠️ Di channel ini sudah ada transaksi aktif! Ketik \`!trade status\` untuk melihatnya, atau \`!trade cancel\` untuk membatalkannya.`;
  }

  const session: TradeSession = {
    channelId,
    player1Id: initiatorId,
    player2Id: targetId,
    offers: {
      [initiatorId]: emptyOffer(),
      [targetId]: emptyOffer(),
    },
    createdAt: Date.now(),
  };

  activeTrades.set(channelId, session);

  return `🤝 **SESI DAGANG DIBUKA!**
**${initiatorName}** mengajak **${targetName}** untuk berdagang!

📋 **Cara Trading:**
- \`!trade offer <coins> <gems> [nama_item]\` — Masukkan penawaranmu (contoh: \`!trade offer 10 5000 Iron Sword\`)
- \`!trade status\` — Lihat penawaran saat ini
- \`!trade confirm\` — Setujui dan selesaikan transaksi
- \`!trade cancel\` — Batalkan

⏰ Sesi ini akan otomatis dibatalkan setelah **5 menit** jika tidak ada konfirmasi!`;
}

/** !trade offer <coins> <gems> [item] — Ubah penawaran */
export function handleTradeOffer(
  db: MinigameDB,
  channelId: string,
  authorId: string,
  coins: number,
  gems: number,
  itemName: string | null
): string {
  const session = activeTrades.get(channelId);
  if (!session) return `❌ Tidak ada sesi dagang aktif di sini. Mulai dengan \`!trade @user\`.`;
  if (!session.offers[authorId]) return `❌ Kamu bukan bagian dari transaksi ini!`;

  const player = getPlayer(db, authorId);

  // Validation
  if (coins < 0 || gems < 0) return `❌ Angka tidak boleh negatif!`;
  if (coins > player.coins) return `❌ Kamu hanya punya **${player.coins} Coin**, tidak bisa menawarkan ${coins} Coin!`;
  if (gems > player.gems) return `❌ Kamu hanya punya **${player.gems} Gems**, tidak bisa menawarkan ${gems} Gems!`;

  if (itemName) {
    const hasItem = player.items.some(i => i.toLowerCase() === itemName.toLowerCase());
    if (!hasItem) return `❌ Item **"${itemName}"** tidak ada di tasmu! Cek \`!inv\` untuk melihat daftarnya.`;
  }

  // Update offer & reset BOTH confirmations (penawaran berubah = perlu konfirmasi ulang)
  session.offers[authorId] = { coins, gems, item: itemName, confirmed: false };
  // Reset the other party's confirmation too since offer changed
  const otherId = authorId === session.player1Id ? session.player2Id : session.player1Id;
  if (session.offers[otherId]) session.offers[otherId].confirmed = false;

  const itemStr = itemName ? ` + Item **${itemName}**` : '';
  return `📦 Penawaran kamu diperbarui: **${coins} Coin, ${gems} Gems${itemStr}**
⚠️ Semua konfirmasi direset. Ketik \`!trade confirm\` untuk menyetujui jika sudah sepakat!`;
}

/** !trade status — Lihat penawaran saat ini */
export function handleTradeStatus(channelId: string, db: MinigameDB): string {
  const session = activeTrades.get(channelId);
  if (!session) return `❌ Tidak ada sesi dagang aktif di channel ini.`;

  const p1 = session.player1Id;
  const p2 = session.player2Id;

  // Resolve display names
  const getDisplayName = (id: string) => {
    const p = getPlayer(db, id);
    return id; // We can only show ID here since we don't have guild member cache
  };

  return `📊 **STATUS TRANSAKSI AKTIF**
━━━━━━━━━━━━━━━━━━━━
${formatOffer(session.offers[p1], `🧍 ${p1}`)}
${formatOffer(session.offers[p2], `🧍 ${p2}`)}
━━━━━━━━━━━━━━━━━━━━
Ketik \`!trade confirm\` untuk menyetujui, atau \`!trade cancel\` untuk membatalkan.`;
}

/** !trade confirm — Konfirmasi dan selesaikan transaksi */
export function handleTradeConfirm(
  db: MinigameDB,
  channelId: string,
  authorId: string
): string {
  const session = activeTrades.get(channelId);
  if (!session) return `❌ Tidak ada sesi dagang aktif di sini.`;
  if (!session.offers[authorId]) return `❌ Kamu bukan bagian dari transaksi ini!`;

  session.offers[authorId].confirmed = true;

  const p1Id = session.player1Id;
  const p2Id = session.player2Id;
  const bothConfirmed = session.offers[p1Id].confirmed && session.offers[p2Id].confirmed;

  if (!bothConfirmed) {
    const otherId = authorId === p1Id ? p2Id : p1Id;
    return `✅ Kamu sudah setuju! Menunggu pihak lain (**${otherId}**) untuk mengetik \`!trade confirm\`...`;
  }

  // ============================================================
  // BOTH CONFIRMED — EXECUTE TRADE ATOMICALLY
  // ============================================================
  const offer1 = session.offers[p1Id]; // What player1 gives
  const offer2 = session.offers[p2Id]; // What player2 gives

  const player1 = getPlayer(db, p1Id);
  const player2 = getPlayer(db, p2Id);

  // Final double-spend check
  if (offer1.coins > player1.coins) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** ${p1Id} tidak lagi memiliki ${offer1.coins} Coin yang dijanjikan! Sesi dibatalkan.`;
  }
  if (offer1.gems > player1.gems) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** ${p1Id} tidak lagi memiliki ${offer1.gems} Gems yang dijanjikan! Sesi dibatalkan.`;
  }
  if (offer1.item && !player1.items.some(i => i.toLowerCase() === offer1.item!.toLowerCase())) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** Item **${offer1.item}** tidak ada di tas ${p1Id}! Sesi dibatalkan.`;
  }
  if (offer2.coins > player2.coins) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** ${p2Id} tidak lagi memiliki ${offer2.coins} Coin yang dijanjikan! Sesi dibatalkan.`;
  }
  if (offer2.gems > player2.gems) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** ${p2Id} tidak lagi memiliki ${offer2.gems} Gems yang dijanjikan! Sesi dibatalkan.`;
  }
  if (offer2.item && !player2.items.some(i => i.toLowerCase() === offer2.item!.toLowerCase())) {
    activeTrades.delete(channelId);
    return `❌ **TRANSAKSI GAGAL!** Item **${offer2.item}** tidak ada di tas ${p2Id}! Sesi dibatalkan.`;
  }

  // --- Execute the transfer ---
  // Player1 gives to Player2
  player1.coins  -= offer1.coins;
  player1.gems -= offer1.gems;
  player2.coins  += offer1.coins;
  player2.gems += offer1.gems;
  if (offer1.item) {
    const idx = player1.items.findIndex(i => i.toLowerCase() === offer1.item!.toLowerCase());
    if (idx !== -1) { player1.items.splice(idx, 1); player2.items.push(offer1.item); }
  }

  // Player2 gives to Player1
  player2.coins  -= offer2.coins;
  player2.gems -= offer2.gems;
  player1.coins  += offer2.coins;
  player1.gems += offer2.gems;
  if (offer2.item) {
    const idx = player2.items.findIndex(i => i.toLowerCase() === offer2.item!.toLowerCase());
    if (idx !== -1) { player2.items.splice(idx, 1); player1.items.push(offer2.item); }
  }

  saveMinigameDB(db);
  activeTrades.delete(channelId);

  const p1Received: string[] = [];
  if (offer2.coins  > 0) p1Received.push(`${offer2.coins} Coin`);
  if (offer2.gems > 0) p1Received.push(`${offer2.gems} Gems`);
  if (offer2.item)     p1Received.push(`Item: **${offer2.item}**`);

  const p2Received: string[] = [];
  if (offer1.coins  > 0) p2Received.push(`${offer1.coins} Coin`);
  if (offer1.gems > 0) p2Received.push(`${offer1.gems} Gems`);
  if (offer1.item)     p2Received.push(`Item: **${offer1.item}**`);

  return `🎉 **TRANSAKSI BERHASIL!**
━━━━━━━━━━━━━━━━━━━━
📥 **${p1Id}** menerima: ${p1Received.length ? p1Received.join(', ') : 'Tidak ada'}
📥 **${p2Id}** menerima: ${p2Received.length ? p2Received.join(', ') : 'Tidak ada'}
━━━━━━━━━━━━━━━━━━━━
✅ Aset sudah berpindah dengan aman. Terima kasih sudah bertransaksi!`;
}

/** !trade cancel — Batalkan transaksi */
export function handleTradeCancel(channelId: string, authorId: string): string {
  const session = activeTrades.get(channelId);
  if (!session) return `❌ Tidak ada sesi dagang aktif di sini.`;
  if (!session.offers[authorId]) return `❌ Kamu bukan bagian dari transaksi ini!`;

  activeTrades.delete(channelId);
  return `🚫 Transaksi dibatalkan oleh **${authorId}**. Semua aset tetap aman di masing-masing pemiliknya.`;
}
