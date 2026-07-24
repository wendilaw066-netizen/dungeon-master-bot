import Groq from 'groq-sdk';
import { logger } from '../logger';

/**
 * Sends a dynamic roleplay prompt to Groq API (Llama 3) based on a bot's persona.
 */
export async function generateBotResponse(
  personaName: string,
  systemPrompt: string,
  userMessage: string,
  gameState: any
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    logger.warn('GROQ_API_KEY is missing. Using fallback response.', 'LLMCore');
    return `[SYSTEM] *Sistem AI belum terhubung ke otak utama (Groq API Key hilang). ${personaName} mengabaikan obrolanmu.*`;
  }

  try {
    const groq = new Groq({ apiKey });
    
    // Construct the context
    const context = `
Kamu adalah bot AI di game Discord Three Kingdoms RPG.
Sifat dan Latar Belakangmu: ${systemPrompt}
Status Kota Kamu Saat Ini:
- Faksi: ${gameState.faction || 'Netral'}
- Kekayaan: ${gameState.coins || 0} Coins
- Pasukan: ${(gameState.town?.army?.infantry || 0) + (gameState.town?.army?.archers || 0) + (gameState.town?.army?.cavalry || 0)} prajurit
- Sifat Bawaan AI: ${gameState.personality || 'Normal'}

Instruksi: Balas pesan pengguna secara singkat (1-3 kalimat), in-character, dan gunakan gaya bahasa sesuai sifatmu. Jangan pernah beri tahu bahwa kamu adalah AI, kamu adalah karakter di dalam game. Jangan membalas dengan format yang tidak natural.
`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: userMessage }
      ]
    });

    const replyText = response.choices[0]?.message?.content;
    if (replyText) {
       return replyText;
    }
    
    return `*Mendengus kesal*`;
  } catch (error: any) {
    logger.error(`Groq API Error: ${error.message}`, 'LLMCore');
    return `*Tengah sibuk mengurus kota, tidak bisa membalas sekarang.*`;
  }
}
