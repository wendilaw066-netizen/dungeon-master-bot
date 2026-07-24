const fs = require('fs');
const path = 'src/utils/rpg/dungeon_v2.ts';

let content = fs.readFileSync(path, 'utf8');

// Rename old function
content = content.replace(
  'export function handleDungeonCampaign(\n  db: MinigameDB, player: PlayerInventory, args: string[], userId: string, ownerId: string | null = null\n): { embeds: EmbedBuilder[] } {',
  'export function resolveAutoDungeon(\n  db: MinigameDB, player: PlayerInventory, args: string[], userId: string, ownerId: string | null = null\n): { embeds: EmbedBuilder[] } {'
);

const newLogic = `
export function handleDungeonCampaign(
  db: MinigameDB, player: PlayerInventory, args: string[], userId: string, ownerId: string | null = null
): { embeds: EmbedBuilder[], components?: ActionRowBuilder<any>[] } {
  
  if (args[0]?.toLowerCase() === 'auto' || args[0]?.toLowerCase() === 'sweep') {
    return resolveAutoDungeon(db, player, args, userId, ownerId);
  }

  if (player.hp <= 0) {
    const e = new EmbedBuilder().setColor(0x2C3E50 as number)
      .setTitle('💀  Kamu Pingsan!')
      .setDescription('Pergi ke **Tavern** untuk istirahat gratis (\`!tavern rest\`) atau beli Elixir (\`!tavern drink elixir\`).');
    return { embeds: [e] };
  }

  // Check if already in a battle
  if (player.activeDungeonBattle) {
    return buildDungeonUI(player);
  }

  // Parse args for specific stage if provided
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
        const e = new EmbedBuilder().setColor(COLORS.BANK_WARN)
          .setTitle('🔒  Stage Belum Terbuka!')
          .setDescription(
            \`Progress tertinggimu: **\${DIFFICULTIES[player.dungeonProgress.difficulty]} › Ch.\${player.dungeonProgress.chapter} › Stage \${player.dungeonProgress.stage}**\\n\` +
            \`Selesaikan stage saat ini dulu!\`
          );
        return { embeds: [e] };
      }
      tDiff = di; tChap = c; tStage = s;
    }
  }

  // Handle Boss interception
  if (tStage === 10) {
    const monsterName = rnd(MONSTER_NAMES[tDiff] ?? ['Unknown Enemy']);
    const monster = getMonsterStats(tDiff, tChap, tStage);
    if (!player.activeBossBattle) {
      player.activeBossBattle = {
        hp: monster.hp * 2, // Boss is 2x stronger
        maxHp: monster.hp * 2,
        state: 'IDLE',
        name: \`Boss \${monsterName}\`
      };
      saveMinigameDB(db);
    }
    return buildBossUI(player, monster.damage);
  }

  // Start new normal battle
  const monsterName = rnd(MONSTER_NAMES[tDiff] ?? ['Unknown Enemy']);
  const monster = getMonsterStats(tDiff, tChap, tStage);
  
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

  const embed = new EmbedBuilder()
    .setColor(diffColor as any)
    .setTitle(\`⚔️ BATTLE: \${battle.name} — \${diffEmoji} \${DIFFICULTIES[battle.diff]} Ch.\${battle.chap} Stage \${battle.stage}\`)
    .addFields(
      { name: '👹 ' + battle.name, value: \`HP: **\${battle.hp}** / \${battle.maxHp}\\nATK: **\${battle.damage}**\`, inline: true },
      { name: '👤 Kamu', value: \`HP: **\${player.hp}** / \${player.maxHp}\`, inline: true }
    );

  if (extraMsg) {
    embed.setDescription(extraMsg);
  } else {
    embed.setDescription('Apa yang akan kamu lakukan?');
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dngatk').setLabel('Attack').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('dngdef').setLabel('Defend').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dngheal').setLabel('Heal').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dngflee').setLabel('Flee').setEmoji('🏃').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ============================================================
export function resolveAutoDungeon(
`;

content = content.replace('export function resolveAutoDungeon(\n', newLogic);


const actionLogic = `
// --------------------------------------------------
// INTERACTIVE TURN RESOLUTION
// --------------------------------------------------
export function handleDungeonAction(db: MinigameDB, player: PlayerInventory, action: string, userId: string) {
  const battle = player.activeDungeonBattle;
  if (!battle) return { content: 'Tidak ada pertarungan yang aktif.' };

  const stats = calculatePlayerStats(player);
  let playerDamage = Math.max(1, stats.attack);
  let monsterDamage = battle.damage;
  let resultMsg = '';

  degradeEquipmentDurability(player, 1);

  if (action === 'dngatk') {
    battle.hp -= playerDamage;
    resultMsg += \`⚔️ Kamu menyerang dengan **\${playerDamage}** damage!\\n\`;
    if (battle.hp > 0) {
      player.hp -= monsterDamage;
      resultMsg += \`🩸 \${battle.name} balik menyerang dengan **\${monsterDamage}** damage!\\n\`;
    }
  } else if (action === 'dngdef') {
    monsterDamage = Math.floor(monsterDamage * 0.3);
    player.hp -= monsterDamage;
    resultMsg += \`🛡️ Kamu menahan serangan! Hanya terkena **\${monsterDamage}** damage.\\n\`;
  } else if (action === 'dngheal') {
    const healAmt = Math.floor(player.maxHp * 0.3);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    resultMsg += \`🧪 Kamu memulihkan **\${healAmt}** HP.\\n\`;
    player.hp -= monsterDamage;
    resultMsg += \`🩸 \${battle.name} menyerangmu saat kamu lengah dengan **\${monsterDamage}** damage!\\n\`;
  } else if (action === 'dngflee') {
    player.hp -= monsterDamage;
    player.activeDungeonBattle = null;
    saveMinigameDB(db);
    const e = new EmbedBuilder().setColor(COLORS.BANK_WARN).setTitle('🏃 Kamu Melarikan Diri!').setDescription(\`Kamu kabur dari pertarungan, tapi terkena serangan dari belakang sebesar **\${monsterDamage}** damage!\\n\\nSisa HP: \${player.hp}\`);
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
      .setTitle(\`💀  DEFEAT  —  \${diffEmoji} \${DIFFICULTIES[battle.diff]} Ch.\${battle.chap} Stage \${battle.stage}\`)
      .setDescription(resultMsg + '\\n\\n' + rnd(LOSE_FLAVOUR))
      .addFields(
        { name: '💡  Cara Bangkit', value: '\`!tavern rest\` — Istirahat gratis\\n\`!repair\` — Perbaiki equipment', inline: false }
      );
    return { embeds: [embed] };
  }

  // Check Victory
  if (battle.hp <= 0) {
    player.activeDungeonBattle = null;
    const baseGems = (battle.diff + 1) * (Math.floor(Math.random() * 500) + 100);
    const weaponDrop = rollDungeonDrop(battle.diff);
    const gtDrop = rollGtItemDrop(battle.diff);
    
    player.gems += baseGems;
    if (weaponDrop) player.items.push(weaponDrop.name);
    if (gtDrop) {
      if (!player.gtItems) player.gtItems = [];
      if (player.gtItems.length < 15) player.gtItems.push(gtDrop.name);
    }

    // Advance Stage
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
    const dropLine = weaponDrop ? \`\${RARITY_EMOJI[weaponDrop.rarity]} **\${weaponDrop.name}**\` : '*No item drop*';
    const gtDropLine = gtDrop ? \`\${RARITY_EMOJI_GT[gtDrop.rarity]} **\${gtDrop.name}**\` : null;

    const embed = new EmbedBuilder()
      .setColor(DIFF_COLORS[battle.diff] as any)
      .setTitle(\`🔥  VICTORY!  —  \${diffEmoji} \${DIFFICULTIES[battle.diff]} Ch.\${battle.chap} Stage \${battle.stage}\`)
      .setDescription(resultMsg + '\\n\\n' + rnd(WIN_FLAVOUR))
      .addFields(
        { name: '💰  Gems', value: \`+**\${fmt(baseGems)}**\`, inline: true },
        { name: '❤️  HP Sisa', value: \`\${player.hp}\`, inline: true },
        { name: '🎁  Drops', value: dropLine + (gtDropLine ? \`\\n\${gtDropLine}\` : ''), inline: false }
      );
      
    if (advanced) {
      const nextLabel = \`\${DIFFICULTIES[player.dungeonProgress.difficulty]} › Ch.\${player.dungeonProgress.chapter} › Stage \${player.dungeonProgress.stage}\`;
      embed.addFields({ name: '🔓  Stage Berikutnya', value: \`➡️ **\${nextLabel}**\`, inline: false });
    }

    return { embeds: [embed] };
  }

  // Next Turn
  saveMinigameDB(db);
  return buildDungeonUI(player, resultMsg);
}
`;

fs.writeFileSync(path, content + actionLogic);
console.log('Done rewriting.');
