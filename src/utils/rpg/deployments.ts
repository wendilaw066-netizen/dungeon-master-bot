import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { getPlayer, saveMinigameDB, PlayerInventory, Deployment } from '../minigame';
import { pushDashboardLog } from './dashboard';
import { COLORS } from './ui';
import { activeWorldBoss } from './world-boss';
import { randomUUID } from 'crypto';

export function deployArmyModal(userId: string, targetType: 'DUNGEON' | 'WORLD_BOSS'): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`modal_deploy_${targetType.toLowerCase()}_${userId}`)
    .setTitle(`Deploy to ${targetType === 'DUNGEON' ? 'Dungeon' : 'World Boss'}`);

  const iInput = new TextInputBuilder().setCustomId('input_infantry').setLabel('Infantry').setStyle(TextInputStyle.Short).setValue('0');
  const aInput = new TextInputBuilder().setCustomId('input_archers').setLabel('Archers').setStyle(TextInputStyle.Short).setValue('0');
  const cInput = new TextInputBuilder().setCustomId('input_cavalry').setLabel('Cavalry').setStyle(TextInputStyle.Short).setValue('0');
  const sInput = new TextInputBuilder().setCustomId('input_spearmen').setLabel('Spearmen').setStyle(TextInputStyle.Short).setValue('0');
  const catInput = new TextInputBuilder().setCustomId('input_catapults').setLabel('Catapults').setStyle(TextInputStyle.Short).setValue('0');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(iInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(aInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(cInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(sInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(catInput)
  );

  return modal;
}

export function handleDeployArmySubmit(
  db: any, 
  userId: string, 
  targetType: 'DUNGEON' | 'WORLD_BOSS', 
  troops: { infantry: number, archers: number, cavalry: number, spearmen: number, catapults: number }
): EmbedBuilder {
  const player = getPlayer(db, userId);
  const town = player.town;

  if (!town) {
    return new EmbedBuilder().setColor(0xE74C3C as any).setTitle('❌ No Town').setDescription('You need to establish a town first!');
  }
  if (!town.army) town.army = { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 };

  const reqI = Math.max(0, isNaN(troops.infantry) ? 0 : troops.infantry);
  const reqA = Math.max(0, isNaN(troops.archers) ? 0 : troops.archers);
  const reqC = Math.max(0, isNaN(troops.cavalry) ? 0 : troops.cavalry);
  const reqS = Math.max(0, isNaN(troops.spearmen) ? 0 : troops.spearmen);
  const reqCat = Math.max(0, isNaN(troops.catapults) ? 0 : troops.catapults);
  
  const totalReq = reqI + reqA + reqC + reqS + reqCat;

  if (totalReq <= 0) {
    return new EmbedBuilder().setColor(0xE74C3C as any).setTitle('❌ Error').setDescription('You must send at least 1 unit!');
  }

  if (
    (town.army.infantry || 0) < reqI ||
    (town.army.archers || 0) < reqA ||
    (town.army.cavalry || 0) < reqC ||
    (town.army.spearmen || 0) < reqS ||
    (town.army.catapults || 0) < reqCat
  ) {
    return new EmbedBuilder().setColor(0xE74C3C as any).setTitle('❌ Error').setDescription('Not enough troops in your town garrison!');
  }

  // Deduct troops
  town.army.infantry -= reqI;
  town.army.archers -= reqA;
  town.army.cavalry -= reqC;
  town.army.spearmen = (town.army.spearmen || 0) - reqS;
  town.army.catapults = (town.army.catapults || 0) - reqCat;

  const durationMin = targetType === 'DUNGEON' ? 30 : 15; // 30 min for dungeon, 15 min for world boss
  const deploy: Deployment = {
    id: randomUUID(),
    missionType: targetType,
    troops: { infantry: reqI, archers: reqA, cavalry: reqC, spearmen: reqS, catapults: reqCat },
    startTime: Date.now(),
    returnTime: Date.now() + (durationMin * 60 * 1000),
    status: 'active'
  };

  if (!player.activeDeployments) player.activeDeployments = [];
  player.activeDeployments.push(deploy);

  pushDashboardLog(player, `🚩 Dispatched ${totalReq} troops to ${targetType === 'DUNGEON' ? 'Dungeon Exploration' : 'World Boss Raid'}!`);
  saveMinigameDB(db);

  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS as any)
    .setTitle('✅ Deployment Successful')
    .setDescription(`Your army has marched out to the ${targetType === 'DUNGEON' ? 'Dungeon' : 'World Boss'}.\n\nThey will return in **${durationMin} minutes**.`);
}

export function resolveDeployments(client: Client, db: any) {
  const { loadMinigameDB, saveMinigameDB } = require('../minigame');
  const { handleBossAttack } = require('./world-boss');
  let hasChanges = false;
  const now = Date.now();

  for (const uid of Object.keys(db.players || {})) {
    const player = db.players[uid];
    if (!player.activeDeployments || player.activeDeployments.length === 0) continue;

    for (let i = player.activeDeployments.length - 1; i >= 0; i--) {
      const deploy = player.activeDeployments[i];
      if (deploy.status === 'active' && now >= deploy.returnTime) {
        deploy.status = 'completed';
        hasChanges = true;

        const { infantry, archers, cavalry, spearmen, catapults } = deploy.troops;
        const totalSent = infantry + archers + cavalry + spearmen + catapults;
        
        let lostI = 0, lostA = 0, lostC = 0, lostS = 0, lostCat = 0;
        let rewardText = '';
        
        if (deploy.missionType === 'DUNGEON') {
          // Dungeon Logic: 10% base casualty rate
          if (Math.random() < 0.1) lostI = Math.floor(infantry * (0.05 + Math.random() * 0.1));
          if (Math.random() < 0.1) lostA = Math.floor(archers * (0.05 + Math.random() * 0.1));
          if (Math.random() < 0.1) lostC = Math.floor(cavalry * (0.05 + Math.random() * 0.1));
          if (Math.random() < 0.1) lostS = Math.floor(spearmen * (0.05 + Math.random() * 0.1));
          if (Math.random() < 0.1) lostCat = Math.floor(catapults * (0.05 + Math.random() * 0.1));
          
          const gemsWon = Math.floor(totalSent * (1 + Math.random() * 2));
          const coinsWon = Math.floor(totalSent * (0.1 + Math.random() * 0.2));
          player.gems += gemsWon;
          player.coins += coinsWon;
          rewardText = `Looted 💎 ${gemsWon} Gems and 🪙 ${coinsWon} Coins.`;
        } 
        else if (deploy.missionType === 'WORLD_BOSS') {
          // World Boss Logic: Flat damage based on troop types
          const damage = (infantry * 2) + (archers * 3) + (spearmen * 3) + (cavalry * 5) + (catapults * 20);
          if (activeWorldBoss.isActive) {
            handleBossAttack(uid, player.name || 'Commander', client, null, damage); // We will need to modify handleBossAttack to accept base damage!
          }
          
          // Higher casualty rate for World Boss
          lostI = Math.floor(infantry * (0.1 + Math.random() * 0.2));
          lostA = Math.floor(archers * (0.1 + Math.random() * 0.2));
          lostC = Math.floor(cavalry * (0.1 + Math.random() * 0.2));
          lostS = Math.floor(spearmen * (0.1 + Math.random() * 0.2));
          lostCat = Math.floor(catapults * (0.1 + Math.random() * 0.2));
          
          rewardText = `Dealt ${damage} damage to the World Boss!`;
        }

        const surI = Math.max(0, infantry - lostI);
        const surA = Math.max(0, archers - lostA);
        const surC = Math.max(0, cavalry - lostC);
        const surS = Math.max(0, spearmen - lostS);
        const surCat = Math.max(0, catapults - lostCat);

        if (player.town && player.town.army) {
          player.town.army.infantry += surI;
          player.town.army.archers += surA;
          player.town.army.cavalry += surC;
          player.town.army.spearmen += surS;
          player.town.army.catapults += surCat;
        }

        const totalLost = lostI + lostA + lostC + lostS + lostCat;
        const msg = `🎺 **Expedition Returned!** Your ${deploy.missionType} troops have returned. ${rewardText} Casualties: ${totalLost} troops.`;
        pushDashboardLog(player, msg);
        
        player.activeDeployments.splice(i, 1);
      }
    }
  }

  if (hasChanges) {
    saveMinigameDB(db);
  }
}
