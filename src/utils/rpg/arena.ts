import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer, saveMinigameDB, PlayerInventory } from '../minigame';
import { calculatePlayerStats } from './equipment';
import { JOBS } from './jobs';

function calculateElo(winnerRating: number, loserRating: number): { winnerGain: number, loserLoss: number } {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
  
  const winnerGain = Math.round(K * (1 - expectedWinner));
  const loserLoss = Math.round(K * (0 - expectedLoser));
  
  return { winnerGain: Math.max(1, winnerGain), loserLoss: Math.min(-1, loserLoss) };
}

export function handleArena(challengerId: string, targetId: string, challengerName: string, targetName: string): any {
  if (challengerId === targetId) return { content: 'X Kamu tidak bisa menantang diri sendiri!' };

  const db = require('../minigame').loadMinigameDB();
  const p1 = getPlayer(db, challengerId);
  const p2 = getPlayer(db, targetId);

  if (p1.activeArenaBattle) return { content: 'X Kamu masih memiliki pertarungan Arena yang belum selesai!' };
  if (p2.activeArenaBattle) return { content: 'X Lawanmu sedang sibuk bertarung di Arena!' };

  p2.pendingArenaChallenge = challengerId;
  saveMinigameDB(db);

  return { content: '\u2694\ufe0f **' + challengerName + '** menantang <@' + targetId + '> untuk berduel di Arena!\n<@' + targetId + '>, ketik `!arena accept` untuk memulai pertarungan maut ini!' };
}

export function handleArenaAccept(userId: string, userName: string): any {
  const db = require('../minigame').loadMinigameDB();
  const p2 = getPlayer(db, userId);
  
  if (!p2.pendingArenaChallenge) return { content: 'X Tidak ada tantangan Arena untukmu saat ini.' };
  
  const challengerId = p2.pendingArenaChallenge;
  const p1 = getPlayer(db, challengerId);
  
  p2.pendingArenaChallenge = undefined;
  
  if (p1.activeArenaBattle) return { content: 'X Penantangmu sudah masuk ke pertarungan lain!' };

  const stats1 = calculatePlayerStats(p1);
  const stats2 = calculatePlayerStats(p2);

  const battleId = 'arena_' + Date.now();
  
  const battleState = {
    id: battleId,
    p1: challengerId,
    p2: userId,
    hp1: stats1.maxHp,
    hp2: stats2.maxHp,
    maxHp1: stats1.maxHp,
    maxHp2: stats2.maxHp,
    mana1: p1.maxMana || 100,
    mana2: p2.maxMana || 100,
    dmg1: stats1.attack,
    dmg2: stats2.attack,
    turn: challengerId,
    log: 'Pertarungan dimulai! Giliran <@' + challengerId + '>.\n'
  };

  p1.activeArenaBattle = battleState;
  p2.activeArenaBattle = battleState;
  saveMinigameDB(db);

  return renderArenaUI(battleState, p1, p2);
}

export function renderArenaUI(battle: any, p1: PlayerInventory, p2: PlayerInventory) {
  const embed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle('Arena Duel')
    .setDescription(battle.log)
    .addFields(
      { name: 'Pemain 1', value: 'HP: **' + battle.hp1 + ' / ' + battle.maxHp1 + '**\nMana: **' + battle.mana1 + '**', inline: true },
      { name: 'Pemain 2', value: 'HP: **' + battle.hp2 + ' / ' + battle.maxHp2 + '**\nMana: **' + battle.mana2 + '**', inline: true }
    )
    .setFooter({ text: 'Giliran: ' + (battle.turn === battle.p1 ? 'Pemain 1' : 'Pemain 2') });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('arenaatk').setLabel('Attack').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('arenadef').setLabel('Defend').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('arenaskill').setLabel('Skill').setStyle(ButtonStyle.Success)
  );

  return { content: '<@' + battle.turn + '>', embeds: [embed], components: [row] };
}

export function handleArenaAction(db: any, player: PlayerInventory, action: string, userId: string) {
  const battle = player.activeArenaBattle;
  if (!battle) return { content: 'Pertarungan Arena sudah usai.' };
  if (battle.turn !== userId) return { content: 'Bukan giliranmu!', ephemeral: true };

  const isP1 = userId === battle.p1;
  const myHp = isP1 ? 'hp1' : 'hp2';
  const myMana = isP1 ? 'mana1' : 'mana2';
  const myDmg = isP1 ? battle.dmg1 : battle.dmg2;
  const oppHp = isP1 ? 'hp2' : 'hp1';
  const oppDmg = isP1 ? battle.dmg2 : battle.dmg1;
  
  let msg = '';
  let oppDefending = (battle as any)[isP1 ? 'p2Defend' : 'p1Defend'];
  
  if (action === 'attack') {
    let dmg = myDmg;
    if (oppDefending) {
      dmg = Math.floor(dmg * 0.3);
      msg += 'Lawan sedang bertahan! ';
    }
    battle[oppHp] -= dmg;
    msg += '<@' + userId + '> menyerang sebesar **' + dmg + '** damage!\n';
    (battle as any)[isP1 ? 'p1Defend' : 'p2Defend'] = false;
  } else if (action === 'defend') {
    (battle as any)[isP1 ? 'p1Defend' : 'p2Defend'] = true;
    msg += '<@' + userId + '> bersiap menahan serangan berikutnya!\n';
  } else if (action === 'skill') {
    const job = JOBS[player.job?.class] || JOBS['Novice'];
    const cat = job.category;
    let cost = 25;
    
    if (battle[myMana] < cost) {
      msg += 'X <@' + userId + '> mencoba memakai skill tapi Mana tidak cukup! Membuang giliran.\n';
    } else {
      battle[myMana] -= cost;
      if (cat === 'Melee') {
        let dmg = Math.floor(myDmg * 2.5);
        if (oppDefending) dmg = Math.floor(dmg * 0.3);
        battle[oppHp] -= dmg;
        msg += '[MELEE] <@' + userId + '> menebas keras memberikan **' + dmg + '** damage!\n';
      } else if (cat === 'Magic') {
        let dmg = Math.floor(myDmg * 3.0);
        if (oppDefending) dmg = Math.floor(dmg * 0.3);
        battle[oppHp] -= dmg;
        battle[myHp] -= Math.floor(dmg * 0.1);
        msg += '[MAGIC] <@' + userId + '> meledakkan sihir (**' + dmg + '** damage) tapi terkena recoil.\n';
      } else if (cat === 'Support') {
        let heal = Math.floor((isP1 ? battle.maxHp1 : battle.maxHp2) * 0.4);
        battle[myHp] = Math.min(isP1 ? battle.maxHp1 : battle.maxHp2, battle[myHp] + heal);
        msg += '[SUPPORT] <@' + userId + '> memulihkan **' + heal + '** HP!\n';
      } else {
        let dmg = Math.floor(myDmg * 1.5);
        if (oppDefending) dmg = Math.floor(dmg * 0.3);
        battle[oppHp] -= dmg;
        msg += '[SKILL] <@' + userId + '> menggunakan skill dan memberikan **' + dmg + '** damage!\n';
      }
    }
    (battle as any)[isP1 ? 'p1Defend' : 'p2Defend'] = false;
  }

  battle.turn = isP1 ? battle.p2 : battle.p1;
  battle.log = msg + '\nGiliran <@' + battle.turn + '>.';

  if (battle.hp1 <= 0 || battle.hp2 <= 0) {
    let winnerId = battle.hp1 > 0 ? battle.p1 : battle.p2;
    let loserId = battle.hp1 > 0 ? battle.p2 : battle.p1;
    
    const wPlayer = getPlayer(db, winnerId);
    const lPlayer = getPlayer(db, loserId);
    
    const elo = calculateElo(wPlayer.arenaRating || 1000, lPlayer.arenaRating || 1000);
    wPlayer.arenaRating = (wPlayer.arenaRating || 1000) + elo.winnerGain;
    lPlayer.arenaRating = (lPlayer.arenaRating || 1000) + elo.loserLoss;
    wPlayer.pvpWins = (wPlayer.pvpWins || 0) + 1;
    lPlayer.pvpLosses = (lPlayer.pvpLosses || 0) + 1;
    
    wPlayer.activeArenaBattle = undefined;
    lPlayer.activeArenaBattle = undefined;
    saveMinigameDB(db);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('PERTANDINGAN SELESAI')
      .setDescription(msg + '\n\n<@' + winnerId + '> **MEMENANGKAN PERTANDINGAN!**\nELO +' + elo.winnerGain + ' (Total: ' + wPlayer.arenaRating + ')\n<@' + loserId + '> ELO ' + elo.loserLoss + ' (Total: ' + lPlayer.arenaRating + ')');
      
    return { content: '<@' + winnerId + '> <@' + loserId + '>', embeds: [embed], components: [] };
  }

  saveMinigameDB(db);
  const p1Obj = getPlayer(db, battle.p1);
  const p2Obj = getPlayer(db, battle.p2);
  return renderArenaUI(battle, p1Obj, p2Obj);
}

export function handleArenaTop(): any {
  const db = require('../minigame').loadMinigameDB();
  let players = [];
  for (const id in db.players) {
    const p = db.players[id];
    players.push({
      id: id,
      rating: p.arenaRating || 1000,
      wins: p.pvpWins || 0,
      losses: p.pvpLosses || 0
    });
  }
  players.sort((a: any, b: any) => b.rating - a.rating);
  players = players.slice(0, 10);
  let text = '';
  players.forEach((p, index) => {
    text += '#' + (index + 1) + ' <@' + p.id + '> - **' + p.rating + ' ELO** (W:' + p.wins + ' L:' + p.losses + ')\n';
  });
  const embed = new EmbedBuilder().setColor('#FFD700').setTitle('Top 10 Arena Leaderboard').setDescription(text || 'Belum ada data arena.');
  return { embeds: [embed] };
}
