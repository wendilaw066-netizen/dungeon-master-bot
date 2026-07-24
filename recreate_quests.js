const fs = require('fs');

const code = `import { PlayerInventory, MinigameDB, saveMinigameDB, getPlayer } from '../minigame';
import { EmbedBuilder } from 'discord.js';

const QUEST_TYPES = [
  { type: 'kill_mob', text: 'Kalahkan Monster di Dungeon', maxTarget: 10, minTarget: 3 },
  { type: 'craft', text: 'Craft Barang Apa Saja', maxTarget: 3, minTarget: 1 },
  { type: 'sell_auction', text: 'Jual Barang di Auction', maxTarget: 3, minTarget: 1 },
  { type: 'use_skill', text: 'Gunakan Skill di Dungeon', maxTarget: 15, minTarget: 5 },
  { type: 'gacha', text: 'Lakukan Gacha', maxTarget: 5, minTarget: 2 }
];

export function generateDailyQuests(): any[] {
  const quests = [];
  const shuffled = QUEST_TYPES.sort(() => 0.5 - Math.random()).slice(0, 3);
  for (const q of shuffled) {
    const target = Math.floor(Math.random() * (q.maxTarget - q.minTarget + 1)) + q.minTarget;
    quests.push({
      type: q.type,
      target: target,
      progress: 0,
      completed: false,
      description: q.text + ' (' + target + 'x)'
    });
  }
  return quests;
}

export function progressQuest(player: PlayerInventory, type: string, amount: number = 1): boolean {
  if (!player.dailyQuests) return false;
  let updated = false;
  for (const q of player.dailyQuests) {
    if (q.type === type && !q.completed) {
      q.progress += amount;
      if (q.progress >= q.target) {
        q.progress = q.target;
        q.completed = true;
      }
      updated = true;
    }
  }
  return updated;
}

export function checkDailyReset(player: PlayerInventory): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (player.lastDailyDate !== today) {
    player.lastDailyDate = today;
    player.dailyQuests = generateDailyQuests();
    return true;
  }
  return false;
}

export function getDailyQuests(userId: string): any {
  const db = require('../minigame').loadMinigameDB();
  const player = getPlayer(db, userId);
  
  const didReset = checkDailyReset(player);
  if (didReset) saveMinigameDB(db);

  let gemsClaimed = 0;
  for (const q of (player.dailyQuests || [])) {
    if (q.completed && !(q as any).claimed) {
      (q as any).claimed = true;
      gemsClaimed += 200;
    }
  }

  let claimedText = '';
  if (gemsClaimed > 0) {
    player.gems += gemsClaimed;
    saveMinigameDB(db);
    claimedText = '\\n\\n🎉 **SELAMAT!** Kamu mengklaim **' + gemsClaimed + ' Gems** dari quest yang selesai hari ini!';
  }

  let text = '';
  if (player.dailyQuests && player.dailyQuests.length > 0) {
    player.dailyQuests.forEach((q: any, idx: number) => {
      const icon = q.completed ? '✅' : '⬜';
      text += '**' + (idx+1) + '.** ' + icon + ' ' + q.description + ' (' + q.progress + '/' + q.target + ')\\n';
    });
  } else {
    text = "Belum ada quest. Coba lagi besok!";
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📜 Daily Quests')
    .setDescription(text + claimedText)
    .setFooter({ text: 'Selesaikan misi setiap hari untuk mendapatkan Gems!' });
    
  return { embeds: [embed] };
}`;

fs.writeFileSync('src/utils/rpg/quests.ts', code, 'utf8');
`;
