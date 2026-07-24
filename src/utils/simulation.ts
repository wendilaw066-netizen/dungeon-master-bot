import { Client, TextChannel, Webhook, Message } from 'discord.js';
import { getRandomPersona, Persona, personas } from './personas';
import { getChatResponse, searchDatabase, getServerStats, fetchWikiInfo } from './ai';
import { getRelevantMemory } from './memory';
import { logger } from '../logger';
import { db } from '../database';
import { loadMinigameDB, getPlayer } from './minigame';
import { SLOT_NAMES } from './rpg/equipment';

interface ActiveSimulation {
  channelId: string;
  intervalId?: NodeJS.Timeout;
  lastPersonaId?: string;
  isRunning: boolean;
}

const activeSimulations = new Map<string, ActiveSimulation>();

// Find or create a webhook for the simulation
async function getSimulationWebhook(channel: TextChannel): Promise<Webhook> {
  const webhooks = await channel.fetchWebhooks();
  let simWebhook = webhooks.find(wh => wh.name === 'ZHU-Sim-Webhook');
  
  if (!simWebhook) {
    simWebhook = await channel.createWebhook({
      name: 'ZHU-Sim-Webhook',
      avatar: 'https://static.wikia.nocookie.net/growtopia/images/b/b8/World_Lock.png',
    });
  }
  return simWebhook;
}

// ============================================================
// BOT SURVIVAL AI — TIERED DECISION ENGINE
// ============================================================
// Generate the next message using Groq AI
async function generatePersonaMessage(channel: TextChannel, persona: Persona): Promise<string | null> {
  try {
    const db = loadMinigameDB();
    const p  = getPlayer(db, persona.name);
    const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    
    // Check if dead, force heal (Priority 0)
    if (p.hp <= 0) {
      if (p.gems >= 500) return '!tavern drink ale';
      return '!heal';
    }

    // Job check removed since class features are deleted

    // Fetch last 10 messages for context
    const messages = await channel.messages.fetch({ limit: 10 });
    const messageArray = Array.from(messages.values()).reverse();
    
    // Pisahkan pesan terakhir sebagai fokus utama balasan
    const latestMessage = messageArray.pop();
    const latestMessageStr = latestMessage ? `${latestMessage.author.bot ? (latestMessage.author.username || 'Bot') : latestMessage.author.username}: ${latestMessage.content}` : '';

    const chatHistory = messageArray.map(m => {
      const authorName = m.author.bot ? (m.author.username || 'Bot') : m.author.username;
      return `${authorName}: ${m.content}`;
    }).join('\n');

    // Retrieve relevant memory based on current chat history
    const memoryContext = await getRelevantMemory(chatHistory + '\n' + latestMessageStr);

    const prompt = `
[ATURAN ROLEPLAY SANGAT KRITIKAL]
1. JANGAN PERNAH BERTINDAK SEBAGAI AI ATAU ASISTEN. Kamu adalah gamer Growtopia asli dari Indonesia. Namamu: ${persona.name}.
2. Sifatmu: ${persona.systemPrompt}
3. KETIKAN HARUS SANGAT NATURAL & ORGANIK LAYAKNYA MANUSIA DI DISCORD. Jangan kaku!
4. Sering gunakan huruf kecil (lowercase). DILARANG KERAS menggunakan titik atau koma di akhir kalimat!
5. Berikan langsung isi pesanmu TANPA tanda kutip!

[STATUS KONDISIMU SAAT INI (PENTING!)]
- HP Kamu: ${p.hp} / ${p.maxHp} (${Math.round(hpPct * 100)}%)
- Kekayaan: ${p.coins} Coin, ${p.gems} Gems
- Tas Penuh?: ${(p.items?.length || 0) >= 15 ? 'YA! Jual barangmu!' : 'Tidak'}

[FITUR MINIGAME DISCORD (PILIH AKSI TERBAIK BERDASARKAN STATUSMU)]
Kamu sedang bermain minigame di server ini. Baca chat terakhir, jika kamu baru saja mati atau kalah, BELAJAR DARI KESALAHAN! Jangan ulangi aksi bodoh!
Pilihan aksimu (Pilih salah satu dengan membalas command ini saja, ATAU balas chat biasa jika ingin mengobrol):
- "!farm" : Aman, dapat Gems. Lakukan jika HP sekarat atau miskin.
- "!dungeon" : Bahaya! Hanya lakukan jika HP-mu > 60% dan punya senjata. Bisa mati!
- "!heal" : Wajib dilakukan jika HP-mu di bawah 30% (Bayar 5 Coin).
- "!tavern drink ale" : Heal murah pakai 500 Gems.
- "!buy wl 1" : Beli 1 Coin seharga 2000 Gems.
- "!buy weapon" : Beli senjata (butuh Coin).
- "!gacha" : Gacha judi (butuh 50 Coin).
- "!boss attack" : Serang World Boss jika sedang muncul.

Jika kamu memutuskan untuk melakukan aksi game, CUKUP balas dengan command tersebut saja (misal: "!dungeon").

[KONTEKS OBROLAN LAMA]
${chatHistory}

[PESAN TERBARU Yg HARUS DIBALAS]
>>> ${latestMessageStr} <<<

${memoryContext}

Tugas: FOKUS BACA DAN BALAS "PESAN TERBARU" SAJA secara langsung dan nyambung. JANGAN halu bikin narasi sendiri atau balas pesan yang terlalu lama. Kalau ditanya ya dijawab, kalau disapa ya disapa balik.`;

    const firstMessages = [{ role: 'user', content: prompt }];
    let aiText = await getChatResponse(firstMessages as any);

    if (!aiText) return null;

    // Check if AI wants to search the database or wiki
    const searchMatch = aiText.match(/\[SEARCH:([^\]]+)\]/);
    const wikiMatch = aiText.match(/\[WIKI:([^\]]+)\]/);
    if (searchMatch || wikiMatch) {
      let dbResult = '';
      if (wikiMatch) {
        dbResult = `Hasil bacaan Wiki untuk "${wikiMatch[1]}":\n${await fetchWikiInfo(wikiMatch[1])}`;
      } else if (searchMatch) {
        dbResult = `Hasil pencarian database lokal untuk "${searchMatch[1]}":\n${searchDatabase(searchMatch[1])}`;
      }
      
      const secondMessages = [
        ...firstMessages,
        { role: 'assistant', content: aiText },
        { role: 'user', content: `Data tambahan:\n${dbResult}\n\nSekarang balas pertanyaan tadi pakai data ini. INGAT ATURAN KRITIKAL: Ketikan harus 100% natural, santai (gw, lu, yg, ga, dll), JANGAN KAKU, dan TANPA TITIK di akhir kalimat. JANGAN tulis [SEARCH] atau [WIKI] lagi.` }
      ];
      aiText = await getChatResponse(secondMessages as any) || aiText;
    }

    // Clean up leftover tags
    aiText = aiText.replace(/\[SEARCH:[^\]]*\]/g, '').replace(/\[WIKI:[^\]]*\]/g, '').replace(/\[STATS\]/g, '').trim();

    return aiText;
  } catch (error) {
    logger.error(`Error generating simulation message for ${persona.name}: ${error}`, 'Simulation');
    return null;
  }
}

// Perform one tick of the simulation
async function runSimulationTick(client: Client, channelId: string, targetPersonaId?: string) {
  const sim = activeSimulations.get(channelId);
  if (!sim || !sim.isRunning) return;

  const channel = client.channels.cache.get(channelId) as TextChannel;
  if (!channel) {
    stopSimulation(channelId);
    return;
  }

  // If ALL personas should reply
  if (targetPersonaId === 'ALL') {
    for (const p of personas) {
      if (!sim.isRunning) break;
      sim.lastPersonaId = p.id;
      logger.info(`Simulating group response for ${p.name} in ${channel.name}...`, 'Simulation');
      
      const webhook = await getSimulationWebhook(channel);
      const messageContent = await generatePersonaMessage(channel, p);
      
      if (messageContent) {
        await webhook.send({
          content: messageContent,
          username: p.name,
          avatarURL: p.avatarUrl,
        });
      }
      
      // Stagger responses by 2-4 seconds so it looks like they are typing sequentially
      const staggerDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
      await new Promise(res => setTimeout(res, staggerDelay));
    }
    
    // Resume normal random ticks after the barrage
    if (sim.isRunning) {
      const nextDelay = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
      sim.intervalId = setTimeout(() => runSimulationTick(client, channelId), nextDelay);
    }
    return;
  }

  // Pick next persona (forced or random)
  let persona: Persona;
  if (targetPersonaId) {
    const found = personas.find(p => p.id === targetPersonaId);
    persona = found || getRandomPersona(sim.lastPersonaId);
  } else {
    persona = getRandomPersona(sim.lastPersonaId);
  }
  sim.lastPersonaId = persona.id;

  logger.info(`Simulating message for ${persona.name} in ${channel.name}...`, 'Simulation');

  const webhook = await getSimulationWebhook(channel);
  const messageContent = await generatePersonaMessage(channel, persona);

  if (messageContent) {
    await webhook.send({
      content: messageContent,
      username: persona.name,
      avatarURL: persona.avatarUrl,
    });
  }

  // Schedule next tick randomly between 15 to 45 seconds to look human
  if (sim.isRunning) {
    const nextDelay = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
    sim.intervalId = setTimeout(() => runSimulationTick(client, channelId), nextDelay);
  }
}

export function startSimulation(client: Client, channelId: string): boolean {
  if (activeSimulations.has(channelId)) return false; // already running
  
  activeSimulations.set(channelId, {
    channelId,
    isRunning: true,
  });

  // Start immediately
  runSimulationTick(client, channelId);
  logger.info(`Simulation started in channel ${channelId}`, 'Simulation');
  return true;
}

export function stopSimulation(channelId: string): boolean {
  const sim = activeSimulations.get(channelId);
  if (!sim) return false;

  sim.isRunning = false;
  if (sim.intervalId) {
    clearTimeout(sim.intervalId);
  }
  activeSimulations.delete(channelId);
  logger.info(`Simulation stopped in channel ${channelId}`, 'Simulation');
  return true;
}

export function isSimulationRunning(channelId: string): boolean {
  return activeSimulations.has(channelId);
}

// Force a simulation tick immediately (used when a human sends a message)
export async function forceSimulationTick(message: Message) {
  const channelId = message.channel.id;
  const sim = activeSimulations.get(channelId);
  if (!sim || !sim.isRunning) return;

  // Clear existing timeout
  if (sim.intervalId) {
    clearTimeout(sim.intervalId);
  }

  let targetId: string | undefined;

  // 1. Check if the human is replying directly to a bot's message
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMsg) {
        // Find if the author of the replied message matches any persona
        const matchedPersona = personas.find(p => p.name === repliedMsg.author.username);
        if (matchedPersona) {
          targetId = matchedPersona.id;
        }
      }
    } catch (err) {
      logger.error(`Error fetching replied message: ${err}`, 'Simulation');
    }
  }

  // 2. If not replying, check if they mentioned a name in the text
  if (!targetId) {
    const lowerMsg = message.content.toLowerCase();
    if (lowerMsg.includes('semuanya') || lowerMsg.includes('kalian')) targetId = 'ALL';
    else if (lowerMsg.includes('arga')) targetId = 'arga';
    else if (lowerMsg.includes('luna')) targetId = 'luna';
    else if (lowerMsg.includes('kenzo')) targetId = 'kenzo';
    else if (lowerMsg.includes('kira')) targetId = 'kira';
    else if (lowerMsg.includes('evan')) targetId = 'evan';
    else if (lowerMsg.includes('maya')) targetId = 'maya';
  }

  // Add a slight realistic delay before replying (2-4 seconds)
  const delayMs = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
  
  sim.intervalId = setTimeout(() => {
    runSimulationTick(message.client, channelId, targetId);
  }, delayMs);
}
