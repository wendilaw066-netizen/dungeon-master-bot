import * as fs from 'fs';
import * as path from 'path';
import { getChatResponse } from './ai';
import { logger } from '../logger';

const MEMORY_FILE_PATH = path.join(process.cwd(), 'ai-memory.json');

export interface AIFact {
  id: string;
  timestamp: number;
  author: string;
  content: string;
  topics: string[];
}

// Load memory from disk
export function loadMemory(): AIFact[] {
  try {
    if (fs.existsSync(MEMORY_FILE_PATH)) {
      const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error(`Error loading memory: ${error}`, 'Memory');
  }
  return [];
}

// Save memory to disk
export function saveMemory(memory: AIFact[]) {
  try {
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`Error saving memory: ${error}`, 'Memory');
  }
}

// Clear all memory
export function clearMemory() {
  saveMemory([]);
}

// Extract a fact from a user's message using Groq AI
export async function extractFactFromMessage(authorName: string, content: string, isOfficial: boolean = false): Promise<void> {
  // Ignore short messages, likely no facts
  if (content.length < 10) return;

  const prompt = `Analisis pesan ini:
Pengirim: ${authorName}
Kategori: ${isOfficial ? 'PENGUMUMAN RESMI SERVER (Daily Quest, Info, Catch of the Day)' : 'Chat Pemain Biasa'}
Pesan: "${content}"

Tugas:
1. Apakah pesan ini mengandung "fakta", "informasi harga", "tips", atau "pengumuman event/quest" terkait Growtopia?
2. Jika IYA, ekstrak intisari fakta tersebut (singkat) dan tuliskan 1-3 kata kunci topik (pisahkan koma). Format: FAKTA: <isi fakta> | TOPIK: <topik1, topik2>
3. Jika TIDAK mengandung info penting (hanya sapaan, basa-basi, ketawa, pertanyaan singkat), langsung jawab: ABAIKAN.

Balas hanya dengan format tersebut, jangan ada teks tambahan.`;

  try {
    const response = await getChatResponse([{ role: 'user', content: prompt }]);
    if (!response || response.includes('ABAIKAN') || !response.includes('FAKTA:')) return;

    const factMatch = response.match(/FAKTA:\s*(.*?)\s*\|\s*TOPIK:\s*(.*)/i);
    if (factMatch) {
      const factContent = factMatch[1].trim();
      const topics = factMatch[2].split(',').map(t => t.trim().toLowerCase());

      const memory = loadMemory();
      
      // Limit memory size to 1000 facts to prevent huge files
      if (memory.length >= 1000) {
        memory.shift(); 
      }

      const prefix = isOfficial ? '[INFO RESMI SERVER]' : `Menurut ${authorName}:`;

      memory.push({
        id: Date.now().toString(),
        timestamp: Date.now(),
        author: authorName,
        content: `${prefix} ${factContent}`,
        topics: topics,
      });

      saveMemory(memory);
      logger.info(`[Self-Learning] Learned fact (${isOfficial ? 'OFFICIAL' : 'CHAT'}): ${factContent}`, 'Memory');
    }
  } catch (error) {
    logger.error(`Failed to extract fact: ${error}`, 'Memory');
  }
}

// Retrieve relevant facts based on conversation context
export async function getRelevantMemory(chatHistory: string): Promise<string> {
  const memory = loadMemory();
  if (memory.length === 0) return '';

  // Use a simple keyword matching strategy instead of expensive embeddings for now
  // We'll ask the AI to summarize the topics of the current chat history
  const prompt = `Dari riwayat chat berikut, ekstrak 1-3 KATA KUNCI utama (misal: magplant, scam, bgl, coins). Pisahkan dengan koma. Jawab HANYA kata kuncinya saja.\n\n${chatHistory}`;
  
  try {
    const response = await getChatResponse([{ role: 'user', content: prompt }]);
    if (!response) return '';

    const keywords = response.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
    
    // Find memories matching the keywords
    const relevantFacts = memory.filter(fact => {
      // check if any keyword is in the fact content or topics
      const contentLower = fact.content.toLowerCase();
      return keywords.some(kw => contentLower.includes(kw) || fact.topics.includes(kw));
    });

    if (relevantFacts.length > 0) {
      // Get the 5 most recent relevant facts
      const topFacts = relevantFacts.slice(-5).map(f => `- ${f.content}`).join('\n');
      return `\n[MEMORI RELEVAN: Kamu (dan bot lain) mengingat hal berikut dari obrolan masa lalu:]\n${topFacts}\nJika memori ini relevan dengan obrolan saat ini, kamu bisa menyinggungnya dengan gaya bahasamu.`;
    }
  } catch (error) {
    logger.error(`Failed to get relevant memory: ${error}`, 'Memory');
  }
  
  return '';
}
