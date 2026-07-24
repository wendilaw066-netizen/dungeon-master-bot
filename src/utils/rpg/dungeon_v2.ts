import { EMOJIS } from './emojis';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInventory, MinigameDB, saveMinigameDB, getPlayer } from '../minigame';
import { calculatePlayerStats, degradeEquipmentDurability } from './equipment';
import { JOBS } from './jobs';
import { COLORS, hpBar, fmt } from './ui';
import { rollDungeonDrop, RARITY_EMOJI, RARITY_COLOR } from './weapons';
import { rollGtItemDrop, RARITY_EMOJI_GT } from './items';

const DIFFICULTIES = ['Normal', 'Hard', 'Nightmare', 'Hell', 'Torment'];
const DIFF_COLORS   = [COLORS.SUCCESS, 0x3498DB as number, 0x9B59B6 as number, COLORS.BANK_WARN, COLORS.BOSS];
const DIFF_EMOJIS   = ['🟢', '🔵', '🟣', '🔴', '💀'];

const MONSTER_NAMES: Record<number, string[]> = {
  0: ['Goblin', 'Skeleton', 'Slime', 'Rat King', 'Bandit'],
  1: ['Orc Warrior', 'Dark Elf', 'Werewolf', 'Iron Golem', 'Vampire Bat'],
  2: ['Demon Knight', 'Lich', 'Hydra', 'Flame Elemental', 'Shadow Assassin'],
  3: ['Hell Baron', 'Undead Dragon', 'Abyssal Worm', 'Chaos Titan', 'Soul Devourer'],
  4: ['Arch-Demon', 'God of Ruin', 'Void Leviathan', 'Ancient Lich King', 'The Oblivion'],
};

const WIN_FLAVOUR = [
  `${EMOJIS.unit_infantry} *Senjatamu menembus pertahanan musuh dengan telak!*`,
  '🔥 *Serangan finalmu membakar monster hingga abu!*',
  '💥 *Satu pukulan dahsyat mengakhiri segalanya!*',
  '🌩️ *Kilat dari langit menghantam tepat di kepala monster!*',
  '🩸 *Pertarungan sengit, tapi kamu yang berdiri terakhir!*',
];
const LOSE_FLAVOUR = [
  '💀 *Kamu jatuh ke tanah, pandanganmu menghitam...*',
  '😵 *Monster terlalu kuat. Kamu dihempaskan dengan brutal.*',
  '🩸 *Darahmu mengalir deras... kesadaranmu memudar.*',
  '⚰️ *"Hari ini bukan harimu, petualang."* — Suara misterius',
  '💫 *Bintang berputar di kepalamu saat kamu menghantam lantai dungeon.*',
];

function getMonsterStats(diff: number, chap: number, stage: number) {
  const absStage = (diff * 30) + ((chap - 1) * 10) + stage;
  return {
    hp:     Math.floor(50 * absStage * (1 + (absStage * 0.1))),
    damage: Math.floor(10 * absStage * (1 + (absStage * 0.05))),
  };
}

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }


// ============================================================
// AUTO-RESOLVE FOR AI AND SWEEP
// ============================================================
export function resolveAutoDungeon(
  db: MinigameDB, player: PlayerInventory, args: string[], userId: string, ownerId: string | null = null
): { embeds: EmbedBuilder[] } {

  let tDiff  = player.dungeonProgress.difficulty;
  let tChap  = player.dungeonProgress.chapter;
  let tStage = player.dungeonProgress.stage;

  if (args[0]?.toLowerCase() === 'sweep') {
    const sweepCount = parseInt(args[1]) || 1;
    if (sweepCount > 10 || sweepCount < 1) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Jumlah sweep harus 1-10.')] };
    }
    
    // Syarat: minimal chapter 2 (berarti sudah clear chapter 1)
    if (player.dungeonProgress.difficulty === 0 && player.dungeonProgress.chapter === 1) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription('Kamu harus menyelesaikan Chapter 1 Normal terlebih dahulu sebelum bisa melakukan auto-sweep.')] };
    }

    if (player.hp < (sweepCount * 10)) {
      return { embeds: [new EmbedBuilder().setColor(COLORS.BANK_WARN).setDescription(`HP mu terlalu rendah untuk sweep ${sweepCount} kali. Butuh minimal ${sweepCount * 10} HP.`)] };
    }

    // Eksekusi Sweep
    const gemsWon = 2000 * sweepCount * (tDiff + 1);
    let tax = 0;
    if (player.coins >= 50) {
      tax = Math.floor(gemsWon * 0.1);
      player.taxPaid = (player.taxPaid || 0) + tax;
    }
    const netGems = gemsWon - tax;
    
    player.gems += netGems;
    player.hp -= (sweepCount * 10);
    degradeEquipmentDurability(player, 5 * sweepCount);
    
    // Drop Bloodstone (30% per sweep chance)
    let bloodstonesGained = 0;
    for(let i=0; i<sweepCount; i++) {
      if (Math.random() < 0.3) bloodstonesGained++;
    }
    if (bloodstonesGained > 0) player.eventBloodstones = (player.eventBloodstones || 0) + bloodstonesGained;

    saveMinigameDB(db);

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('🧹  DUNGEON AUTO-SWEEP')
      .setDescription(`Kamu melakukan auto-sweep di dungeon sebanyak **${sweepCount} kali**.\n\n` + 
                      `**Hasil:**\n` +
                      `${EMOJIS.res_mystic} +**${fmt(netGems)} Gems**\n` +
                      `🩸 -**${sweepCount * 10} HP**\n` +
                      (tax > 0 ? `👑 Pajak: -**${fmt(tax)} Gems**\n` : '') +
                      (bloodstonesGained > 0 ? `🩸 +**${bloodstonesGained} Bloodstone**\n` : ''))
      .setFooter({ text: 'Sweep hanya memakan sedikit HP namun mengurangi durabilitas equipment.' });

    return { embeds: [embed] };
  }

  // Parse auto specific stages: !dungeon auto normal 1 3
  let pIdx = args[0]?.toLowerCase() === 'auto' ? 1 : 0;
  if (args.length >= (pIdx + 3)) {
    const di = DIFFICULTIES.findIndex(d => d.toLowerCase() === args[pIdx].toLowerCase());
    const c  = parseInt(args[pIdx + 1]);
    const s  = parseInt(args[pIdx + 2]);
    if (di !== -1 && !isNaN(c) && !isNaN(s)) {
      if (di > player.dungeonProgress.difficulty ||
         (di === player.dungeonProgress.difficulty && c > player.dungeonProgress.chapter) ||
         (di === player.dungeonProgress.difficulty && c === player.dungeonProgress.chapter && s > player.dungeonProgress.stage)) {
        const e = new EmbedBuilder().setColor(COLORS.BANK_WARN)
          .setTitle('🔒  Stage Belum Terbuka!')
          .setDescription(
            `Progress tertinggimu: **${DIFFICULTIES[player.dungeonProgress.difficulty]} › Ch.${player.dungeonProgress.chapter} › Stage ${player.dungeonProgress.stage}**\n` +
            `Selesaikan stage saat ini dulu!`
          );
        return { embeds: [e] };
      }
      tDiff = di; tChap = c; tStage = s;
    }
  }

  if (player.hp <= 0) {
    const e = new EmbedBuilder().setColor(0x2C3E50 as number)
      .setTitle('💀  Kamu Pingsan!')
      .setDescription('Pergi ke **Tavern** untuk istirahat gratis (`!tavern rest`) atau beli Elixir (`!tavern drink elixir`).');
    return { embeds: [e] };
  }

  // ── Combat Calculation ──
  const stats   = calculatePlayerStats(player);
  const monster = getMonsterStats(tDiff, tChap, tStage);
  degradeEquipmentDurability(player, 5);

  const monsterName       = rnd(MONSTER_NAMES[tDiff] ?? ['Unknown Enemy']);
  const diffColor         = DIFF_COLORS[tDiff] ?? COLORS.INFO;
  const diffEmoji         = DIFF_EMOJIS[tDiff] ?? '❓';
  const playerHitsToKill  = Math.ceil(monster.hp   / Math.max(1, stats.attack));
  const monsterHitsToKill = Math.ceil(player.hp    / Math.max(1, monster.damage));

  if (tStage === 10) {
    if (!player.activeBossBattle) {
      player.activeBossBattle = { hp: monster.hp * 2, maxHp: monster.hp * 2, state: 'IDLE', name: `Boss ${monsterName}` };
      saveMinigameDB(db);
    }
    return buildBossUI(player, monster.damage);
  }

  if (playerHitsToKill <= monsterHitsToKill) {
    const dmgTaken = (playerHitsToKill - 1) * monster.damage;
    player.hp = Math.max(1, player.hp - dmgTaken);
    const baseGems = (tDiff + 1) * (Math.floor(Math.random() * 500) + 100);

    // --- Special Encounter Events (20% chance) ---
    const encRoll = Math.random();
    let encBonus = 0;
    let encWl = 0;
    let encMsg = '';
    let encMat = '';
    let encMatAmt = 0;

    if (encRoll < 0.05) {
      // TREASURE ROOM (5%) - massive bonus
      encBonus = baseGems * 2;
      encWl = Math.floor(Math.random() * 3) + 2;
      encMsg = '🗝️ **TREASURE ROOM!** Kamu menemukan ruangan tersembunyi penuh harta!';
    } else if (encRoll < 0.10) {
      // ELITE MONSTER DEFEATED (5%) - drops better loot
      encBonus = Math.floor(baseGems * 0.8);
      encMat = ['Dragon Scale', 'Mythril', 'Magic Dust'][tDiff % 3];
      encMatAmt = Math.floor(Math.random() * 2) + 1;
      encMsg = '⚡ **ELITE MONSTER** muncul dan dikalahkan! Drop langka didapat!';
    } else if (encRoll < 0.15) {
      // DUNGEON MERCHANT (5%)
      encBonus = Math.floor(baseGems * 0.3);
      encMsg = '🧙 **PEDAGANG DUNGEON** memberikan bonus komisi atas monster yang kamu bunuh!';
    } else if (encRoll < 0.20) {
      // ANCIENT ALTAR (5%) - bonus mana
      player.mana = Math.min((player.maxMana || 100), (player.mana || 0) + 50);
      encMsg = '🏛️ **ALTAR KUNO** memulihkan **50 Mana** darimu!';
    }

    const weaponDrop = rollDungeonDrop(tDiff);
    const gtDrop = rollGtItemDrop(tDiff);
    const materialsPool = [
      ['Wood', 'Iron Ore'],
      ['Iron Ore', 'Magic Dust'],
      ['Magic Dust', 'Dragon Scale'],
      ['Dragon Scale', 'Mythril'],
      ['Mythril', 'Dark Matter']
    ];
    let matDrop = '';
    let matCount = 0;
    if (Math.random() < 0.6) {
      const pool = materialsPool[tDiff] || materialsPool[0];
      matDrop = pool[Math.floor(Math.random() * pool.length)];
      matCount = Math.floor(Math.random() * 3) + 1;
      if (!player.materials) player.materials = {};
      player.materials[matDrop] = (player.materials[matDrop] || 0) + matCount;
    }

    // Apply encounter bonus material
    if (encMat && encMatAmt > 0) {
      if (!player.materials) player.materials = {};
      player.materials[encMat] = (player.materials[encMat] || 0) + encMatAmt;
    }

    let tax = 0;
    if (ownerId && userId !== ownerId) {
      tax = Math.ceil((baseGems + encBonus) * 0.10);
      const owner = getPlayer(db, ownerId);
      owner.gems += tax;
    }
    const gemsWon = baseGems + encBonus - tax;
    player.gems += gemsWon;
    player.coins += encWl;

    if (weaponDrop) player.items.push(weaponDrop.name);
    if (gtDrop) {
      if (!player.gtItems) player.gtItems = [];
      if (player.gtItems.length < 15) player.gtItems.push(gtDrop.name);
    }

    // --- Dungeon XP System ---
    if (!player.dungeonXp) player.dungeonXp = 0;
    if (!player.dungeonLevel) player.dungeonLevel = 1;
    const dungXp = Math.floor(20 + tDiff * 15 + (encBonus > 0 ? 25 : 0));
    player.dungeonXp += dungXp;
    const dungXpNeeded = player.dungeonLevel * 100;
    let dungLevelUpMsg = '';
    if (player.dungeonXp >= dungXpNeeded) {
      player.dungeonXp -= dungXpNeeded;
      player.dungeonLevel += 1;
      player.maxHp += 50;
      player.hp = Math.min(player.maxHp, player.hp + 50);
      dungLevelUpMsg = `${EMOJIS.unit_infantry} **DUNGEON LV.UP → ${player.dungeonLevel}!** (+50 Max HP!)`;
    }

    let advanced = false;
    let newDiffUnlocked = false;
    if (tDiff === player.dungeonProgress.difficulty && tChap === player.dungeonProgress.chapter && tStage === player.dungeonProgress.stage) {
      player.dungeonProgress.stage++;
      advanced = true;
      if (player.dungeonProgress.stage > 10) {
        player.dungeonProgress.stage = 1;
        player.dungeonProgress.chapter++;
        if (player.dungeonProgress.chapter > 3) {
          player.dungeonProgress.chapter = 1;
          player.dungeonProgress.difficulty++;
          newDiffUnlocked = true;
          if (player.dungeonProgress.difficulty > 4) {
            player.dungeonProgress.difficulty = 4;
            player.dungeonProgress.chapter = 3;
            player.dungeonProgress.stage = 10;
            advanced = false;
          }
        }
      }
    }
    saveMinigameDB(db);

    const dropLine = weaponDrop ? `${RARITY_EMOJI[weaponDrop.rarity]} **${weaponDrop.name}**` : '*No item drop*';
    const gtDropLine = gtDrop ? `${RARITY_EMOJI_GT[gtDrop.rarity]} **${gtDrop.name}**` : null;
    const matLine = matDrop ? `🔨 **${matCount}x ${matDrop}**` : null;
    const encMatLine = encMat ? `✨ **${encMatAmt}x ${encMat}**` : null;

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`🔥  VICTORY!  —  ${diffEmoji} ${DIFFICULTIES[tDiff]} Ch.${tChap} Stage ${tStage}`)
      .addFields(
        { name: '💰  Gems', value: `+**${fmt(gemsWon)}**${encBonus > 0 ? ` *(+${fmt(encBonus)} bonus!)*` : ''}`, inline: true },
        { name: '❤️  HP Sisa', value: `${player.hp}`, inline: true },
        { name: '${EMOJIS.unit_infantry}  Dungeon XP', value: `+${dungXp} XP (Lv.${player.dungeonLevel})${dungLevelUpMsg ? `\n${dungLevelUpMsg}` : ''}`, inline: false },
        { name: '🎁  Drops', value: [dropLine, gtDropLine, matLine, encMatLine].filter(Boolean).join('\n'), inline: false }
      );

    if (encMsg) embed.setDescription(`> ${encMsg}`);
    if (encWl > 0) embed.addFields({ name: '🔑 Bonus Coin', value: `+${encWl} Coin`, inline: true });
    if (tax > 0) embed.addFields({ name: '👑 Pajak', value: `-${fmt(tax)} Gems`, inline: true });
    return { embeds: [embed] };
  } else {
    player.hp = 0;
    saveMinigameDB(db);
    const embed = new EmbedBuilder().setColor(COLORS.DUNGEON_LOSE as any).setTitle(`💀  DEFEAT`).setDescription('Kamu dikalahkan oleh ' + monsterName);
    return { embeds: [embed] };
  }
}

// ============================================================
// INTERACTIVE DUNGEON CAMPAIGN
// ============================================================
export function handleDungeonCampaign(
  db: MinigameDB, player: PlayerInventory, args: string[], userId: string, ownerId: string | null = null
): { embeds: EmbedBuilder[], components?: ActionRowBuilder<any>[] } {
  
  if (args[0]?.toLowerCase() === 'auto' || args[0]?.toLowerCase() === 'sweep') {
    return resolveAutoDungeon(db, player, args, userId, ownerId);
  }

  if (player.hp <= 0) {
    const e = new EmbedBuilder().setColor(0x2C3E50 as number)
      .setTitle('💀  Kamu Pingsan!')
      .setDescription('Pergi ke **Tavern** untuk istirahat gratis (`!tavern rest`) atau beli Elixir (`!tavern drink elixir`).');
    return { embeds: [e] };
  }

  if (player.activeDungeonBattle) {
    return buildDungeonUI(player);
  }

  let tDiff  = player.dungeonProgress.difficulty;
  let tChap  = player.dungeonProgress.chapter;
  let tStage = player.dungeonProgress.stage;
  
  if (args.length >= 3) {
    const di = DIFFICULTIES.findIndex(d => d.toLowerCase() === args[0].toLowerCase());
    const c  = parseInt(args[1]);
    const s  = parseInt(args[2]);
    if (di !== -1 && !isNaN(c) && !isNaN(s)) {
      if (di > player.dungeonProgress.difficulty ||
         (di === player.dungeonProgress.difficulty && c > player.dungeonProgress.chapter) ||
         (di === player.dungeonProgress.difficulty && c === player.dungeonProgress.chapter && s > player.dungeonProgress.stage)) {
        const e = new EmbedBuilder().setColor(COLORS.BANK_WARN).setTitle('🔒  Stage Belum Terbuka!').setDescription(`Selesaikan stage saat ini dulu!`);
        return { embeds: [e] };
      }
      tDiff = di; tChap = c; tStage = s;
    }
  }

  const monsterName = rnd(MONSTER_NAMES[tDiff] ?? ['Unknown Enemy']);
  const monster = getMonsterStats(tDiff, tChap, tStage);

  if (tStage === 10) {
    if (!player.activeBossBattle) {
      player.activeBossBattle = { hp: monster.hp * 2, maxHp: monster.hp * 2, state: 'IDLE', name: `Boss ${monsterName}` };
      saveMinigameDB(db);
    }
    return buildBossUI(player, monster.damage);
  }

  player.activeDungeonBattle = {
    hp: monster.hp,
    maxHp: monster.hp,
    damage: monster.damage,
    name: monsterName,
    diff: tDiff,
    chap: tChap,
    stage: tStage
  };
  saveMinigameDB(db);

  return buildDungeonUI(player);
}

export function buildDungeonUI(player: PlayerInventory, extraMsg: string = '') {
  const battle = player.activeDungeonBattle!;
  const diffColor = DIFF_COLORS[battle.diff] ?? COLORS.INFO;
  const diffEmoji = DIFF_EMOJIS[battle.diff] ?? '❓';

  const comboStr = (battle as any).combo && (battle as any).combo > 0 ? `\n🔥 **COMBO:** x${(battle as any).combo}` : '';
  const stunStr = (battle as any).stunned ? '\n🌀 **STUNNED** (Lumpuh)' : '';

  const embed = new EmbedBuilder()
    .setColor(diffColor as any)
    .setTitle(`${EMOJIS.unit_infantry} BATTLE: ${battle.name} — ${diffEmoji} ${DIFFICULTIES[battle.diff]} Ch.${battle.chap} Stage ${battle.stage}`)
    .addFields(
      { name: '👹 ' + battle.name, value: `HP: **${battle.hp}** / ${battle.maxHp}\nATK: **${battle.damage}**${stunStr}`, inline: true },
      { name: '👤 Kamu', value: `HP: **${player.hp}** / ${player.maxHp}${comboStr}`, inline: true }
    );
    
  if (player.town?.activeParty && player.town.activeParty.length > 0) {
    const { GENERALS_DB } = require('./generals');
    let pStr = '';
    player.town.activeParty.forEach(gId => {
      const g = GENERALS_DB.find((x: any) => x.id === gId);
      if (g) pStr += `**${g.name}** (${g.role}) `;
    });
    embed.addFields({ name: `${EMOJIS.btn_shield} Active Party`, value: pStr, inline: false });
  }

  if (extraMsg) {
    embed.setDescription(extraMsg);
  } else {
    embed.setDescription('Apa yang akan kamu lakukan?');
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`dngatk`).setLabel(`Attack`).setEmoji(`${EMOJIS.unit_infantry}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`dngdef`).setLabel(`Defend`).setEmoji(`${EMOJIS.btn_shield}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dngheal').setLabel('Heal').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dngflee').setLabel('Flee').setEmoji('🏃').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dngskill').setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// --------------------------------------------------
// INTERACTIVE TURN RESOLUTION
// --------------------------------------------------
export function handleDungeonAction(db: MinigameDB, player: PlayerInventory, action: string, userId: string) {
  const battle = player.activeDungeonBattle;
  if (!battle) return { embeds: [new EmbedBuilder().setDescription('Pertarungan telah usai.')] };

  const stats = calculatePlayerStats(player);
  let playerDamage = Math.max(1, stats.attack);
  let monsterDamage = battle.damage;
  let resultMsg = '';
  
  // -- PARTY SYSTEM BUFFS --
  let partyDPSBuff = 0;
  let partyTankBuff = 0;
  let partyHealerBuff = 0;
  
  if (player.town?.activeParty) {
    const { GENERALS_DB } = require('./generals');
    player.town.activeParty.forEach((gId: string) => {
      const g = GENERALS_DB.find((x: any) => x.id === gId);
      if (g) {
        if (g.role === 'DPS') partyDPSBuff += g.buffValue;
        if (g.role === 'Tank') partyTankBuff += g.buffValue;
        if (g.role === 'Healer') partyHealerBuff += g.buffValue;
      }
    });
  }

  // Apply Party Buffs
  if (partyDPSBuff > 0) playerDamage = Math.floor(playerDamage * (1 + partyDPSBuff));
  if (partyTankBuff > 0) monsterDamage = Math.floor(monsterDamage * (1 - Math.min(0.8, partyTankBuff))); // cap at 80% reduction
  if (partyHealerBuff > 0) {
    const healAmt = Math.floor(player.maxHp * (partyHealerBuff / 10)); // Heals 3-5% of Max HP per turn
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    resultMsg += `💚 **Party Healer** memulihkan **${healAmt} HP**.\n`;
  }

  degradeEquipmentDurability(player, 1);

  // Initialize combo & stun if not exists
  const b = battle as any;
  if (b.combo === undefined) b.combo = 0;
  if (b.stunned === undefined) b.stunned = false;

  // Stun logic: if monster was stunned, it skips its turn
  let monsterSkips = b.stunned;
  if (b.stunned) {
    b.stunned = false; // Reset stun for next turn
  }

  if (action === 'dngatk') {
    b.combo += 1;
    // Combo multiplier: +20% damage per combo level (max +100% / 2x damage)
    const comboMult = 1 + Math.min(1.0, (b.combo - 1) * 0.2);
    let finalDmg = Math.floor(playerDamage * comboMult);

    // 15% Player Crit Chance
    const isPlayerCrit = Math.random() < 0.15;
    if (isPlayerCrit) {
      finalDmg *= 2;
      resultMsg += `✨ **CRITICAL HIT!** Kamu menebas titik vital musuh sebesar **${finalDmg}** damage! (Combo x${b.combo})\n`;
    } else {
      resultMsg += `${EMOJIS.unit_infantry} Kamu menyerang musuh sebesar **${finalDmg}** damage! (Combo x${b.combo})\n`;
    }
    battle.hp -= finalDmg;

    // Monster retaliates if alive and not stunned
    if (battle.hp > 0) {
      if (monsterSkips) {
        resultMsg += `🌀 ${battle.name} terdiam lumpuh (stunned) dan tidak bisa menyerang!\n`;
      } else {
        // 10% Monster Crit
        const isMonsterCrit = Math.random() < 0.1;
        let finalMonsterDmg = isMonsterCrit ? Math.floor(monsterDamage * 1.5) : monsterDamage;

        // 10% Player Dodge
        const isPlayerDodge = Math.random() < 0.1;
        if (isPlayerDodge) {
          resultMsg += `💨 **DODGE!** Kamu berguling dengan cepat menghindari serangan ${battle.name}!\n`;
        } else {
          player.hp -= finalMonsterDmg;
          resultMsg += `🩸 ${isMonsterCrit ? '💥 **CRIT!** ' : ''}${battle.name} membalas dan melukaimu sebesar **${finalMonsterDmg}** HP!\n`;
        }
      }
    }

  } else if (action === 'dngdef') {
    b.combo = 0; // Reset combo
    monsterDamage = Math.floor(monsterDamage * 0.3); // Block 70% damage

    // 30% Chance to stun the monster when defending!
    const gotStun = Math.random() < 0.3;
    if (gotStun) {
      b.stunned = true;
      resultMsg += `${EMOJIS.btn_shield} Kamu menangkis dengan tamengmu! Serangan memantul membuat ${battle.name} **STUNNED (lumpuh)**!\n`;
    } else {
      resultMsg += `${EMOJIS.btn_shield} Kamu memasang posisi bertahan yang kokoh!\n`;
    }

    if (!monsterSkips) {
      player.hp -= monsterDamage;
      resultMsg += `🩸 Serangan ${battle.name} diredam, hanya menerima **${monsterDamage}** damage.\n`;
    } else {
      resultMsg += `🌀 ${battle.name} terdiam lumpuh dan melewatkan gilirannya.\n`;
    }

  } else if (action === 'dngskill') {
    b.combo = 0; // Reset combo
    const job = JOBS[player.job?.class] || JOBS['Novice'];
    const cat = job.category;
    let manaCost = 20;
    if (cat === 'Magic') manaCost = 30;
    if (cat === 'Support') manaCost = 25;
    if (cat === 'Ranged') manaCost = 15;
    if (cat === 'Sandbox') manaCost = 10;
    
    if ((player.mana || 0) < manaCost) {
      resultMsg += `❌ Gagal menggunakan Skill! Butuh ${manaCost} Mana (Mana-mu: ${player.mana}). Kamu membuang giliranmu!\n`;
      if (!monsterSkips) {
        player.hp -= monsterDamage;
        resultMsg += `🩸 ${battle.name} menyerang dengan **${monsterDamage}** damage!\n`;
      } else {
        resultMsg += `🌀 ${battle.name} lumpuh dan tidak menyerang.\n`;
      }
    } else {
      player.mana = (player.mana || 0) - manaCost;


      if (cat === 'Melee') {
        const dmg = Math.floor(playerDamage * 2.5);
        battle.hp -= dmg;
        resultMsg += `🌟 [MELEE SKILL] Kamu menebas dengan kuat memberikan **${dmg}** damage!\n`;
      } else if (cat === 'Ranged') {
        const dmg = Math.floor(playerDamage * 1.5);
        battle.hp -= dmg;
        monsterDamage = Math.floor(monsterDamage * 0.5); // dodge half dmg
        resultMsg += `🌟 [RANGED SKILL] Kamu menembak dari jauh (**${dmg}** damage) dan menghindari sebagian serangan!\n`;
      } else if (cat === 'Magic') {
        const dmg = Math.floor(playerDamage * 3.0);
        battle.hp -= dmg;
        player.hp -= Math.floor(dmg * 0.1); // 10% recoil
        resultMsg += `🌟 [MAGIC SKILL] Kamu melontarkan sihir dahsyat (**${dmg}** damage) namun terkena recoil.\n`;
      } else if (cat === 'Support') {
        const healAmt = Math.floor(player.maxHp * 0.4);
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        battle.hp -= playerDamage;
        resultMsg += `🌟 [SUPPORT SKILL] Kamu memulihkan **${healAmt}** HP dan memukul kecil (**${playerDamage}** damage)!\n`;
      } else { // Sandbox / Novice
        const dmg = playerDamage;
        battle.hp -= dmg;
        player.gems += 50;
        resultMsg += `🌟 [SANDBOX SKILL] Kamu melempar koin ke arah musuh (**${dmg}** damage) dan mencuri 50 Gems!\n`;
      }

      if (battle.hp > 0) {
        if (monsterSkips) {
          resultMsg += `🌀 ${battle.name} terdiam lumpuh dan tidak bisa menyerang!\n`;
        } else {
          player.hp -= monsterDamage;
          resultMsg += `🩸 ${battle.name} balik menyerang dengan **${monsterDamage}** damage!\n`;
        }
      }
    }
  } else if (action === 'dngheal') {
    b.combo = 0; // Reset combo
    const healAmt = Math.floor(player.maxHp * 0.3);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    resultMsg += `🧪 Kamu meminum ramuan memulihkan **${healAmt}** HP.\n`;
    if (battle.hp > 0) {
      if (monsterSkips) {
        resultMsg += `🌀 ${battle.name} terdiam lumpuh dan tidak menyerang.\n`;
      } else {
        player.hp -= monsterDamage;
        resultMsg += `🩸 ${battle.name} menyerangmu saat kamu lengah dengan **${monsterDamage}** damage!\n`;
      }
    }
  } else if (action === 'dngflee') {
    if (!monsterSkips) {
      player.hp -= monsterDamage;
    }
    player.activeDungeonBattle = null;
    saveMinigameDB(db);
    const fleeDmgMsg = monsterSkips ? 'dan berhasil lolos tanpa terluka!' : `tapi terkena serangan dari belakang sebesar **${monsterDamage}** damage!`;
    const e = new EmbedBuilder().setColor(COLORS.BANK_WARN).setTitle('🏃 Kamu Melarikan Diri!').setDescription(`Kamu kabur dari pertarungan, ${fleeDmgMsg}\n\nSisa HP: ${player.hp}`);
    return { embeds: [e] };
  }

  // Check Death
  if (player.hp <= 0) {
    player.hp = 0;
    player.activeDungeonBattle = null;
    saveMinigameDB(db);
    const diffEmoji = DIFF_EMOJIS[battle.diff] ?? '❓';
    const embed = new EmbedBuilder()
      .setColor(COLORS.DUNGEON_LOSE as any)
      .setTitle(`💀  DEFEAT  —  ${diffEmoji} ${DIFFICULTIES[battle.diff]} Ch.${battle.chap} Stage ${battle.stage}`)
      .setDescription(resultMsg + '\n\n' + rnd(LOSE_FLAVOUR))
      .addFields({ name: '💡  Cara Bangkit', value: '\`!tavern rest\` — Istirahat gratis\n\`!repair\` — Perbaiki equipment', inline: false });
    return { embeds: [embed] };
  }

  // Check Victory
  if (battle.hp <= 0) {
    player.activeDungeonBattle = null;

    const baseGems = (battle.diff + 1) * (Math.floor(Math.random() * 500) + 100);
    const weaponDrop = rollDungeonDrop(battle.diff);
    const gtDrop = rollGtItemDrop(battle.diff);
    const materialsPool = [
      ['Wood', 'Iron Ore'],
      ['Iron Ore', 'Magic Dust'],
      ['Magic Dust', 'Dragon Scale'],
      ['Dragon Scale', 'Mythril'],
      ['Mythril', 'Dark Matter']
    ];
    let matDrop = '';
    let matCount = 0;
    if (Math.random() < 0.6) {
      const pool = materialsPool[battle.diff] || materialsPool[0];
      matDrop = pool[Math.floor(Math.random() * pool.length)];
      matCount = Math.floor(Math.random() * 3) + 1;
      if (!player.materials) player.materials = {};
      player.materials[matDrop] = (player.materials[matDrop] || 0) + matCount;
    }

    
    player.gems += baseGems;
    if (weaponDrop) player.items.push(weaponDrop.name);
    if (gtDrop) {
      if (!player.gtItems) player.gtItems = [];
      if (player.gtItems.length < 15) player.gtItems.push(gtDrop.name);
    }

    let advanced = false;
    let newDiffUnlocked = false;
    if (battle.diff === player.dungeonProgress.difficulty &&
        battle.chap === player.dungeonProgress.chapter &&
        battle.stage === player.dungeonProgress.stage) {
      player.dungeonProgress.stage++;
      advanced = true;
      if (player.dungeonProgress.stage > 10) {
        player.dungeonProgress.stage = 1;
        player.dungeonProgress.chapter++;
        if (player.dungeonProgress.chapter > 3) {
          player.dungeonProgress.chapter = 1;
          player.dungeonProgress.difficulty++;
          newDiffUnlocked = true;
          if (player.dungeonProgress.difficulty > 4) {
            player.dungeonProgress.difficulty = 4;
            player.dungeonProgress.chapter = 3;
            player.dungeonProgress.stage = 10;
            advanced = false;
          }
        }
      }
    }
    saveMinigameDB(db);

    const diffEmoji = DIFF_EMOJIS[battle.diff] ?? '❓';
    const dropLine = weaponDrop ? `${RARITY_EMOJI[weaponDrop.rarity]} **${weaponDrop.name}**` : '*No item drop*';
    const gtDropLine = gtDrop ? `${RARITY_EMOJI_GT[gtDrop.rarity]} **${gtDrop.name}**` : null;
    const matLine = matDrop ? `🔨 **${matCount}x ${matDrop}**` : null;

    const embed = new EmbedBuilder()
      .setColor(DIFF_COLORS[battle.diff] as any)
      .setTitle(`🔥  VICTORY!  —  ${diffEmoji} ${DIFFICULTIES[battle.diff]} Ch.${battle.chap} Stage ${battle.stage}`)
      .setDescription(resultMsg + '\n\n' + rnd(WIN_FLAVOUR))
      .addFields(
        { name: '💰  Gems', value: `+**${fmt(baseGems)}**`, inline: true },
        { name: '❤️  HP Sisa', value: `${player.hp}`, inline: true },
        { name: '🎁  Drops', value: dropLine + (gtDropLine ? `\n${gtDropLine}` : '') + (typeof matLine !== 'undefined' && matLine ? `\n${matLine}` : ''), inline: false }
      );
      
    if (advanced) {
      const nextLabel = `${DIFFICULTIES[player.dungeonProgress.difficulty]} › Ch.${player.dungeonProgress.chapter} › Stage ${player.dungeonProgress.stage}`;
      embed.addFields({ name: '🔓  Stage Berikutnya', value: `➡️ **${nextLabel}**`, inline: false });
    }

    return { embeds: [embed] };
  }

  saveMinigameDB(db);
  return buildDungeonUI(player, resultMsg);
}

// --------------------------------------------------
// BOSS FSM (Original logic)
// --------------------------------------------------
export function buildBossUI(player: any, bossBaseDamage: number) {
  const boss = player.activeBossBattle;
  let stateDesc = 'Boss sedang bersiap menyerang!';
  if (boss.state === 'ENRAGE') stateDesc = 'Mata boss menyala MERAH! Damage meningkat 2x lipat!';
  if (boss.state === 'CHARGING') stateDesc = '⚠️ Boss mengumpulkan ENERGI MAUT! Bertahanlah!';

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('👹 BOSS BATTLE: ' + boss.name)
    .setDescription(stateDesc)
    .addFields(
      { name: 'Boss HP', value: '**' + boss.hp + '** / ' + boss.maxHp, inline: true },
      { name: 'Your HP', value: '**' + player.hp + '** / ' + player.maxHp + '\n🔵 **Mana:** ' + (player.mana || 0) + ' / ' + (player.maxMana || 100), inline: true }
    );
    
  if (player.town?.activeParty && player.town.activeParty.length > 0) {
    const { GENERALS_DB } = require('./generals');
    let pStr = '';
    player.town.activeParty.forEach((gId: string) => {
      const g = GENERALS_DB.find((x: any) => x.id === gId);
      if (g) pStr += `**${g.name}** (${g.role}) `;
    });
    embed.addFields({ name: `${EMOJIS.btn_shield} Active Party`, value: pStr, inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bossatk_` + bossBaseDamage).setLabel(`Attack`).setEmoji(`${EMOJIS.unit_infantry}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`bossdef_` + bossBaseDamage).setLabel(`Defend`).setEmoji(`${EMOJIS.btn_shield}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bossheal_' + bossBaseDamage).setLabel('Heal').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bossskill_' + bossBaseDamage).setLabel('Skill').setEmoji('🌟').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

export function handleBossAction(db: any, player: any, action: string, bossBaseDamage: number) {
  const boss = player.activeBossBattle;
  if (!boss) return { content: 'Tidak ada pertarungan boss yang aktif.' };

  const stats = calculatePlayerStats(player);
  let playerDamage = Math.max(1, stats.attack);
  let bossDamage = boss.state === 'ENRAGE' ? bossBaseDamage * 2 : bossBaseDamage;
  let resultMsg = '';
  
  // -- PARTY SYSTEM BUFFS --
  let partyDPSBuff = 0;
  let partyTankBuff = 0;
  let partyHealerBuff = 0;
  
  if (player.town?.activeParty) {
    const { GENERALS_DB } = require('./generals');
    player.town.activeParty.forEach((gId: string) => {
      const g = GENERALS_DB.find((x: any) => x.id === gId);
      if (g) {
        if (g.role === 'DPS') partyDPSBuff += g.buffValue;
        if (g.role === 'Tank') partyTankBuff += g.buffValue;
        if (g.role === 'Healer') partyHealerBuff += g.buffValue;
      }
    });
  }

  // Apply Party Buffs
  if (partyDPSBuff > 0) playerDamage = Math.floor(playerDamage * (1 + partyDPSBuff));
  if (partyTankBuff > 0) bossDamage = Math.floor(bossDamage * (1 - Math.min(0.8, partyTankBuff)));
  if (partyHealerBuff > 0) {
    const healAmt = Math.floor(player.maxHp * (partyHealerBuff / 10));
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    resultMsg += `💚 **Party Healer** memulihkan **${healAmt} HP**.\n`;
  }

  if (action === 'attack') {
    if (boss.state === 'CHARGING') {
      bossDamage = bossBaseDamage * 5;
      resultMsg += '💥 Kamu menyerang saat boss sedang CHARGING! Terkena serangan fatal!\n';
      player.hp -= bossDamage;
    } else {
      boss.hp -= playerDamage;
      resultMsg += `${EMOJIS.unit_infantry} Kamu menyerang boss dengan **` + playerDamage + `** damage!\n`;
      player.hp -= bossDamage;
      resultMsg += '🩸 Boss balik menyerang dengan **' + bossDamage + '** damage!\n';
    }
  } else if (action === 'skill') {
    const job = JOBS[player.job?.class] || JOBS['Novice'];
    const cat = job.category;
    let manaCost = 20;
    if (cat === 'Magic') manaCost = 30;
    if (cat === 'Support') manaCost = 25;
    if (cat === 'Ranged') manaCost = 15;
    if (cat === 'Sandbox') manaCost = 10;
    
    if ((player.mana || 0) < manaCost) {
      resultMsg += `❌ Gagal menggunakan Skill! Butuh ${manaCost} Mana (Mana-mu: ${player.mana}). Kamu membuang giliranmu!\n`;
      player.hp -= bossDamage;
      resultMsg += `🩸 ${boss.name} menyerang dengan **${bossDamage}** damage!\n`;
    } else {
      player.mana = (player.mana || 0) - manaCost;


      if (boss.state === 'CHARGING') {
        bossDamage = bossBaseDamage * 5;
        resultMsg += '💀 Kamu mencoba skill saat boss sedang CHARGING! Terkena serangan fatal!\n';
        player.hp -= bossDamage;
      } else {
        if (cat === 'Melee') {
          const dmg = Math.floor(playerDamage * 2.5);
          boss.hp -= dmg;
          resultMsg += `🌟 [MELEE SKILL] Kamu menebas Boss dengan kuat (**${dmg}** damage)!\n`;
        } else if (cat === 'Ranged') {
          const dmg = Math.floor(playerDamage * 1.5);
          boss.hp -= dmg;
          bossDamage = Math.floor(bossDamage * 0.5); // dodge half dmg
          resultMsg += `🌟 [RANGED SKILL] Kamu menembak dari jauh (**${dmg}** damage) dan menghindari separuh serangan!\n`;
        } else if (cat === 'Magic') {
          const dmg = Math.floor(playerDamage * 3.0);
          boss.hp -= dmg;
          player.hp -= Math.floor(dmg * 0.1); // 10% recoil
          resultMsg += `🌟 [MAGIC SKILL] Kamu melontarkan sihir dahsyat (**${dmg}** damage) namun terkena recoil.\n`;
        } else if (cat === 'Support') {
          const healAmt = Math.floor(player.maxHp * 0.4);
          player.hp = Math.min(player.maxHp, player.hp + healAmt);
          boss.hp -= playerDamage;
          resultMsg += `🌟 [SUPPORT SKILL] Kamu memulihkan **${healAmt}** HP dan memukul kecil (**${playerDamage}** damage)!\n`;
        } else { // Sandbox / Novice
          const dmg = playerDamage;
          boss.hp -= dmg;
          player.gems += 50;
          resultMsg += `🌟 [SANDBOX SKILL] Kamu melempar koin (**${dmg}** damage) dan mencuri 50 Gems!\n`;
        }

        if (boss.hp > 0) {
          player.hp -= bossDamage;
          resultMsg += `🩸 ${boss.name} balik menyerang dengan **${bossDamage}** damage!\n`;
        }
      }
    }
  } else if (action === 'defend') {
    if (boss.state === 'CHARGING') {
      bossDamage = Math.floor(bossBaseDamage * 0.5);
      resultMsg += `${EMOJIS.btn_shield} Berhasil menahan Ultimate Boss! Hanya terkena **` + bossDamage + `** damage.\n`;
      player.hp -= bossDamage;
    } else {
      bossDamage = Math.floor(bossDamage * 0.3);
      resultMsg += `${EMOJIS.btn_shield} Menahan serangan biasa. Terkena **` + bossDamage + `** damage.\n`;
      player.hp -= bossDamage;
    }
  } else if (action === 'heal') {
    const healAmt = Math.floor(player.maxHp * 0.4);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    resultMsg += '🧪 Kamu meminum potion dan pulih **' + healAmt + '** HP.\n';
    player.hp -= bossDamage;
    resultMsg += '🩸 Boss menyerangmu dengan **' + bossDamage + '** damage!\n';
  }

  if (player.hp <= 0) {
    player.activeBossBattle = null;
    saveMinigameDB(db);
    const e = new EmbedBuilder().setColor(0x2C3E50).setTitle('💀 Kamu Gugur di Tangan Boss!').setDescription(resultMsg + '\n\nPergi ke Tavern untuk istirahat.');
    return { embeds: [e] };
  }
    if (boss.hp <= 0) {
      player.activeBossBattle = null;
      player.dungeonProgress.stage++;
      if (player.dungeonProgress.stage > 10) {
        player.dungeonProgress.stage = 1;
        player.dungeonProgress.chapter++;
        if (player.dungeonProgress.chapter > 3) {
          player.dungeonProgress.chapter = 1;
          player.dungeonProgress.difficulty++;
          if (player.dungeonProgress.difficulty > 4) {
            player.dungeonProgress.difficulty = 4;
            player.dungeonProgress.chapter = 3;
            player.dungeonProgress.stage = 10;
          }
        }
      }
      saveMinigameDB(db);
      const e = new EmbedBuilder().setColor(0xF1C40F).setTitle('🏆 BOSS DIKALAHKAN!').setDescription(resultMsg + '\n\nKamu berhasil menaklukkan Dungeon Chapter ini!');
      return { embeds: [e] };
    }


  const rng = Math.random();
  if (boss.hp < boss.maxHp * 0.3) {
    boss.state = 'ENRAGE';
  } else if (rng < 0.2 && boss.state !== 'CHARGING') {
    boss.state = 'CHARGING';
  } else {
    boss.state = 'IDLE';
  }

  saveMinigameDB(db);
  const ui = buildBossUI(player, bossBaseDamage);
  ui.embeds[0].setDescription(resultMsg + '\n\n' + ui.embeds[0].data.description);
  return ui;
}
