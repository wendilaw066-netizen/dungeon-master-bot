import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { Message } from 'discord.js';
import { logger } from '../logger';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;

const ITEMS_PATH = path.join(process.cwd(), 'growtopia-items.json');
const PRICES_PATH = path.join(process.cwd(), 'growtopia-prices.json');

// --------------------------------------------------------
// Load databases directly from JSON files
// --------------------------------------------------------
function loadItems(): Record<string, any> {
  try {
    if (fs.existsSync(ITEMS_PATH)) return JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
  } catch (e) {}
  return {};
}

function loadPrices(): Record<string, any> {
  try {
    if (fs.existsSync(PRICES_PATH)) return JSON.parse(fs.readFileSync(PRICES_PATH, 'utf-8'));
  } catch (e) {}
  return {};
}

function savePrices(data: Record<string, any>) {
  try {
    fs.writeFileSync(PRICES_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error(`Error saving prices: ${err}`, 'DB');
  }
}

export function parseAndSaveTradeList(content: string): number {
  const lines = content.split('\n');
  let savedCount = 0;
  const pricesDb = loadPrices();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 1. Tentukan mata uang
    let currency = 'DL'; // Fallback default
    const emojiMatch = trimmed.match(/<:([A-Za-z0-9_]+):\d+>/);
    if (emojiMatch) {
      currency = emojiMatch[1].toUpperCase();
    } else if (trimmed.toLowerCase().includes('bgl')) {
      currency = 'BGL';
    } else if (trimmed.toLowerCase().includes('dl')) {
      currency = 'DL';
    } else if (trimmed.toLowerCase().includes('wl')) {
      currency = 'Coin';
    }
    
    // 2. Bersihkan teks dari emoji dan teks mata uang di akhir
    let cleanLine = trimmed.replace(/<:[A-Za-z0-9_]+:\d+>/g, '').trim(); // Hapus discord emoji
    cleanLine = cleanLine.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(); // Hapus unicode emoji (💎)
    cleanLine = cleanLine.replace(/\s+(bgl|dl|wl)$/i, '').trim(); // Hapus teks mata uang di ujung
    
    const tokens = cleanLine.split(/\s+/);
    if (tokens.length < 2) continue;
    
    // 3. Ekstrak harga dari ujung (elemen terakhir harus angka)
    const priceStr = tokens.pop();
    if (!priceStr || isNaN(Number(priceStr))) continue;
    const price = Number(priceStr);
    
    // 4. Bersihkan kata Buy/Sell di awal kalimat
    const firstWord = tokens[0].toLowerCase();
    if (firstWord === 'buy' || firstWord === 'sell') {
      tokens.shift();
    }
    
    if (tokens.length === 0) continue;
    let nameStr = tokens.join(' ');
    
    // 5. Ekstrak nama asli (sebelum garis miring / alias)
    if (nameStr.includes('/')) {
      nameStr = nameStr.split('/')[0].trim();
      // Kadang setelah di split jadinya "Sell Pet Mech Robot", hapus Sell/Buy lagi jika ada
      if (nameStr.toLowerCase().startsWith('buy ')) nameStr = nameStr.substring(4).trim();
      if (nameStr.toLowerCase().startsWith('sell ')) nameStr = nameStr.substring(5).trim();
    }
    
    const finalName = nameStr.toLowerCase();
    if (finalName.length > 0) {
      pricesDb[finalName] = {
        priceRange: `${price} ${currency}`,
        trend: "Ihemo Forward"
      };
      savedCount++;
    }
  }

  if (savedCount > 0) {
    savePrices(pricesDb);
  }

  return savedCount;
}

// --------------------------------------------------------
// Conversation history per user (in-memory)
// --------------------------------------------------------
const conversationHistory = new Map<string, { role: string; content: string }[]>();

export function clearConversationHistory(guildId: string) {
  for (const key of conversationHistory.keys()) {
    if (key.startsWith(`${guildId}-`)) {
      conversationHistory.delete(key);
    }
  }
}

// --------------------------------------------------------
// Database Search Tool
// --------------------------------------------------------
export function searchDatabase(query: string): string {
  const itemsDb = loadItems();
  const pricesDb = loadPrices();
  const lowerQuery = query.toLowerCase();

  const results: string[] = [];
  const foundItemNames = new Set<string>();
  let count = 0;
  
  // 1. Cari di itemsDb
  for (const key of Object.keys(itemsDb)) {
    if (key.includes(lowerQuery) || itemsDb[key].item?.toLowerCase().includes(lowerQuery)) {
      const item = itemsDb[key];
      const itemNameLower = (item.item || '').toLowerCase();
      foundItemNames.add(itemNameLower);
      
      const priceKey = Object.keys(pricesDb).find(k => k === itemNameLower || k.includes(itemNameLower));
      const price = priceKey ? pricesDb[priceKey] : null;
      results.push(
        `• ${item.item} | Harga: ${price ? price.priceRange : 'Belum diatur'} | Tren: ${price ? price.trend : 'N/A'}`
      );
      count++;
      if (count >= 8) break;
    }
  }

  // 2. Cari di pricesDb langsung (untuk item dari Ihemo yang belum ada di itemsDb)
  if (count < 8) {
    for (const key of Object.keys(pricesDb)) {
      if (key.includes(lowerQuery) && !foundItemNames.has(key)) {
        const price = pricesDb[key];
        results.push(
          `• ${key} | Harga: ${price.priceRange} | Tren: ${price.trend}`
        );
        foundItemNames.add(key);
        count++;
        if (count >= 8) break;
      }
    }
  }

  if (results.length === 0) return 'Item tidak ditemukan di database manapun.';
  return results.join('\n');
}

export async function fetchWikiInfo(query: string): Promise<string> {
  try {
    const title = encodeURIComponent(query.trim().replace(/ /g, '_'));
    const url = `https://growtopia.fandom.com/api.php?action=query&prop=extracts&explaintext=1&titles=${title}&redirects=1&format=json`;
    const res = await fetch(url);
    const data = await res.json() as any;
    
    if (!data.query || !data.query.pages) return "Gagal menghubungi Fandom Wiki.";
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1') {
      return `Info: Item '${query}' tidak ditemukan di Growtopia Wiki. Coba cari dengan nama yang lebih pas.`;
    }
    
    let extract = pages[pageId].extract;
    // Limit to 1500 chars so we don't blow up the AI context window
    return extract ? extract.substring(0, 1500) + '... (Terpotong)' : "Halaman kosong.";
  } catch (err) {
    logger.error(`Wiki fetch error: ${err}`, 'AI');
    return "Error saat membaca Wiki.";
  }
}

export function getServerStats(): string {
  const itemsDb = loadItems();
  const pricesDb = loadPrices();
  const withImages = Object.values(itemsDb).filter((v: any) => v.image).length;
  return `Total item di database: ${Object.keys(itemsDb).length}\nTotal harga yang sudah diatur: ${Object.keys(pricesDb).length}\nItem dengan gambar: ${withImages}`;
}

export function getSystemPrompt(botName: string): string {
  return `Kamu adalah ${botName}, asisten AI ramah & gaul untuk server Discord ini (termasuk trading Growtopia & RPG Settlement to Kingdom).
Gaya bicaramu santai dan gaul seperti gamer Indonesia (pakai kata: bro, gw, lu, cuy, dll). Namamu: ${botName}.
Tugasmu: bantu player soal harga item Growtopia atau CARA MAIN MINIGAME RPG & SETTLEMENT CITY-BUILDER!

PENJELASAN LENGKAP CARA MAIN MINIGAME RPG & SETTLEMENT CITY-BUILDER:
1. PERINTAH UTAMA:
   - Ketik '!menu' di channel Discord untuk membuka Dashboard Utama interaktif satu-klik!
   - Ketik '!start' untuk klaim starter pack pertama kali.

2. DASHBOARD & GAMEPLAY UTAMA (!menu):
   - 🌾 Farm: Klik 'Farm' di !menu untuk panen Gems & World Locks (Coin). Auto-convert 2.000 Gems -> 1 Coin.
   - ⚔️ Dungeon & Boss: Bertarung di dungeon bertingkat & kalahkan boss jahat.
   - 🎰 Gacha (500 Gems): Putar gacha item & equipment senjata.
   - 📜 Story Campaign: Misi cerita RPG bertingkat dengan dialog NPC (Elder Arthur, Commander Vane) & reward Coin.
   - 🤝 Trade P2P: Penukaran instan 2.000 Gems -> 1 Coin & transaksi antar-pemain.
   - 📈 Bursa Pasar: Fluktuasi harga Wood & Iron Ore dinamis per jam. Beli di harga murah, jual saat mahal!
   - 🐉 World Raid: Mengerahkan seluruh pasukan militer kota untuk melawan Maha-Naga Dunia (1.000.000 HP).
   - 🔮 Relic Fusion: Lebur 50 Wood + 50 Iron Ore + 5 Coin menjadi Relik Legendaris (+500 Max HP).

3. KOTA & PEMBANGUNAN WILAYAH (!menu -> Kota):
   - Hierarki Wilayah: Village (T1) -> Town (T2) -> City (T3) -> Barony (T4) -> Duchy (T5) -> Kingdom (T6).
   - Rules Slot: 1 Bidang Tanah = 4 Slot Pembangunan. Harga tanah naik seiring total pemain di server!
   - Bangunan Utama:
     * 🏠 Rumah (2 Slot): Menampung 2 Villager (+10 Gems/menit pajak pasif).
     * 🌾 Ladang (1 Slot): +10% Farm Gems & suplai pangan villager (Morale 100%).
     * 🚰 Sumur Kota (1 Slot): Cegah kebakaran & tingkatkan ketahanan kota.
     * ⛏️ Tambang (2 Slot): Penghasil Wood & Iron Ore pasif per 15 menit.
     * 🍊 Kebun Buah (4 Slot): Drop buah panen pasif.
     * 🐄 Peternakan (2 Slot): Menampung hewan (Ayam, Kambing, Sapi) penghasil Coin pasif!
     * 🏰 Menara & 🐕 Anjing: Menangkal serangan Bandit & Raid pemain lain.
     * 🏥 Rumah Sakit (2 Slot): Auto-heal HP +10 per 10 menit.
     * 🍺 Tavern (2 Slot): Buff ATK & Farm +20%.
     * 🔬 Akademi (4 Slot): Riset teknologi (Advanced Farming & Metallurgy).
     * 🏦 Bank Kota (2 Slot): Bunga simpanan 2%/hari & pinjaman modal.
     * 🏟️ Colosseum (4 Slot): Arena PvP Kota.
     * 🗡️ Barak Pasukan (4 Slot - Tier 3+): Rekrut Infantry (Prajurit Pedang).
     * 🏹 Archery Range (4 Slot - Tier 3+): Rekrut Archer (Pemanah).
     * 🐎 Stable Kavaleri (4 Slot - Tier 3+): Rekrut Cavalry (Kavaleri Berkuda).
     * 💎 World Wonder (4 Slot - Tier 4+): Mahakarya untuk klaim gelar High King (Kaisar Server).
     * 🔄 Rebirth Kerajaan (Tier 6): Reset kota ke Desa Pertama dengan Permanen Prestise Level (+25% bonus pendapatan & power).
     * 💣 Robohkan Bangunan: Mengosongkan slot tanah & refund 50% Gems.
     * 🏆 Ranking Kota: Papan peringkat penguasa kota terkuat server!

PENTING - Cara menggunakan database:
Jika user nanya tentang item atau harga Growtopia, kamu HARUS tuliskan tepat di awal responmu:
[SEARCH:nama_item]

Contoh:
User: "harga magplant berapa?"  ->  [SEARCH:magplant]
User: "info diamond lock"  ->  [SEARCH:diamond lock]

Jika user nanya tentang cara main RPG/Kota/Settlement:
Jawab dengan ramah, jelaskan fitur minigame RPG & Kota di atas secara santai, gaul, dan jelas!

ATURAN CHAT:
1. Jawab HANYA DENGAN HURUF KECIL (lowercase) dan sangat santai.
2. JANGAN PERNAH gunakan titik atau koma di akhir kalimat.
3. Kalau pertanyaannya umum, jawab langsung tanpa tag.`;
}

const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

async function generateWithFallback(messages: any[], maxTokens = 512, temperature = 0.7): Promise<any> {
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await groq!.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      return response;
    } catch (err: any) {
      logger.warn(`Model ${model} gagal (${err.message}). Mencoba model berikutnya...`, 'AI');
      continue;
    }
  }
  throw new Error("Semua model AI limit atau error.");
}

// --------------------------------------------------------
// Main AI handler - called when bot is @mentioned
// --------------------------------------------------------
export async function handleAiMention(message: Message, botUserId: string) {
  if (!groq) {
    await message.reply('❌ Admin belum memasang `GROQ_API_KEY` di file `.env`. Bot belum bisa berpikir!');
    return;
  }

  const prompt = message.content.replace(new RegExp(`<@!?${botUserId}>`, 'g'), '').trim();
  if (!prompt) {
    await message.reply('Hei bro! Ada yang bisa gue bantu? Tanya aja soal harga item atau info Growtopia!');
    return;
  }

  await (message.channel as any)?.sendTyping?.();

  const botName = message.client.user?.username || 'Bot';
  const systemPrompt = getSystemPrompt(botName);

  const historyKey = `${message.guildId}-${message.author.id}`;
  if (!conversationHistory.has(historyKey)) {
    conversationHistory.set(historyKey, []);
  }
  const history = conversationHistory.get(historyKey)!;

  try {
    // Step 1: Ask AI what to do
    const firstMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: prompt }
    ];

    const firstResponse = await generateWithFallback(firstMessages, 512, 0.7);

    let aiText = firstResponse.choices[0]?.message?.content?.trim() || '';

    // Step 2: Check if AI wants to search the database or Wiki
    const searchMatch = aiText.match(/\[SEARCH:([^\]]+)\]/);
    const wikiMatch = aiText.match(/\[WIKI:([^\]]+)\]/);
    const wantsStats = aiText.includes('[STATS]');

    if (searchMatch || wikiMatch || wantsStats) {
      let dbResult = '';
      if (wikiMatch) {
        dbResult = `Hasil bacaan langsung dari Growtopia Wiki untuk "${wikiMatch[1]}":\n${await fetchWikiInfo(wikiMatch[1])}`;
      } else if (searchMatch) {
        dbResult = `Hasil pencarian database lokal untuk "${searchMatch[1]}":\n${searchDatabase(searchMatch[1])}`;
      } else {
        dbResult = `Info server:\n${getServerStats()}`;
      }

      // Step 3: Give database/wiki result to AI for natural response
      const secondMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: prompt },
        { role: 'assistant', content: aiText },
        { role: 'user', content: `Data dari sistem/wiki:\n${dbResult}\n\nSekarang jawab pertanyaan user tadi dengan natural dan singkat berdasarkan data ini. JANGAN tulis [SEARCH] atau [WIKI] lagi.` }
      ];

        const secondResponse = await generateWithFallback(secondMessages, 512, 0.7);

      aiText = secondResponse.choices[0]?.message?.content?.trim() || 'Aduh bro, gue error nih, coba lagi ya!';
    }

    // Clean up any leftover tags
    aiText = aiText.replace(/\[SEARCH:[^\]]*\]/g, '').replace(/\[WIKI:[^\]]*\]/g, '').replace(/\[STATS\]/g, '').trim();
    if (!aiText) aiText = 'Hmm, gue bingung nih bro. Coba tanya lagi ya!';
    if (aiText.length > 1999) aiText = aiText.substring(0, 1990) + '...';

    // Save to history (keep max 10 turns)
    history.push({ role: 'user', content: prompt });
    history.push({ role: 'assistant', content: aiText });
    if (history.length > 20) history.splice(0, 2);

    await message.reply(aiText);
  } catch (error: any) {
    logger.error('Error in AI handler:', 'AI');
    logger.error(error);
    await message.reply('❌ Waduh bro, AI-nya lagi error nih. Coba lagi nanti ya!');
  }
}

// --------------------------------------------------------
// Generic AI Chat completion for simulation
// --------------------------------------------------------
export async function getChatResponse(messages: { role: 'system' | 'user' | 'assistant', content: string }[]): Promise<string | null> {
  if (!groq) return null;
  
  try {
    const response = await generateWithFallback(messages as any, 256, 0.8);
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    logger.error(`Error in getChatResponse: ${error}`, 'AI');
    return null;
  }
}

// --------------------------------------------------------
// Vision AI: Image Analysis & OCR
// --------------------------------------------------------
export async function analyzeImage(imageUrl: string, authorName: string): Promise<string> {
  try {
    const prompt = `Ini adalah screenshot dari game Growtopia (atau chat trade) yang dikirim oleh ${authorName}.
Tugasmu:
1. Baca teks atau tebak apa barang yang sedang di-trade di gambar ini.
2. Ingat-ingat apakah trade ini profit/loss.
3. Berikan komentar santai layaknya gamer Indonesia (pakai lu, gw, wkwk, njir) max 2 kalimat. Jangan kaku! Jangan bilang kamu AI.`;

    const response = await groq!.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          // @ts-ignore
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 512,
      temperature: 0.7,
    });
    
    return response.choices[0]?.message?.content || "Gambar blur nih, nggak keliatan trade apaan.";
  } catch (error) {
    logger.error(`Vision AI Error: ${error}`, 'AI');
    return "Mata gw silau, gagal baca gambarnya.";
  }
}
