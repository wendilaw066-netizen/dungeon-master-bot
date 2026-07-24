const fs = require('fs');
const c = fs.readFileSync('src/utils/minigame.ts', 'utf8');

const newGacha = `
export function gacha(userId) {
  const db = loadMinigameDB();
  const player = getPlayer(db, userId);
  const cost = 50;

  if (player.wls < cost) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('\u{1F3B0}  Gacha SSB \u2014 Tidak Cukup WL')
      .setDescription('Butuh **' + cost + ' WL** untuk buka gacha.\\nKamu punya: **' + player.wls + ' WL**\\n\\nFarming dulu yuk! \\`!farm\\`');
    return { embeds: [embed] };
  }

  const W = require('./rpg/weapons');
  player.wls -= cost;
  const item = W.rollGacha();
  const isJunk = item.id === 'g_dirt_seed';
  const isDrop = !isJunk;
  if (isDrop) player.items.push(item.name);
  saveMinigameDB(db);

  const RARITY_COLOR = W.RARITY_COLOR;
  const RARITY_EMOJI = W.RARITY_EMOJI;
  const banners = {
    Legendary: '\u{1F320}\u2728\u{1F31F}  **L E G E N D A R Y**  \u{1F31F}\u2728\u{1F320}',
    Epic:      '\u{1F49C}  **E P I C**  \u{1F49C}',
    Rare:      '\u{1F499}  **R A R E**  \u{1F499}',
    Uncommon:  '\u{1F49A}  **Uncommon**  \u{1F49A}',
    Common:    '\u2B1C  Common',
  };
  const praise = item.rarity === 'Legendary' ? '> \u{1F38A} **SELAMAT! Kamu dapat drop LEGENDARIS!**' :
                 item.rarity === 'Epic'       ? '> \u{1F38A} **WOW! Item Epic, mantap banget!**' :
                 item.rarity === 'Rare'       ? '> \u{1F44D} Lumayan! Item Rare masuk tas.' :
                 isJunk                       ? '> \u{1F622} *Lagi apes hari ini...*' : '> \u{1F44B} Standar.';

  const embed = new EmbedBuilder()
    .setColor(RARITY_COLOR[item.rarity] || 0x95a5a6)
    .setTitle('\u{1F3B0}  GACHA SSB  \u2014  Spent ' + cost + ' WL')
    .setDescription((banners[item.rarity] || '') + '\\n\\n' + praise)
    .addFields(
      { name: (RARITY_EMOJI[item.rarity] || '') + '  ' + item.emoji + '  ' + item.name,
        value: item.desc + (isDrop ? '\\n\\n\u2694\uFE0F ATK +**' + item.atk + '**  \u2022  \u2764\uFE0F HP +**' + item.hp + '**' : ''),
        inline: false,
      },
    );

  if (isDrop) {
    embed.addFields({
      name: '\u{1F392}  Masuk ke Tas',
      value: 'Gunakan \\`!equip ' + item.name + '\\` untuk memakainya!',
      inline: false,
    });
  }
  embed.setFooter({ text: 'Sisa WL: ' + player.wls + ' WL  \u2022  Rate: 1% Legendary, 9% Epic, 30% Rare' }).setTimestamp();
  return { embeds: [embed] };
}
`;

const before = c.slice(0, 20162);
const result = before + newGacha + '\n';
fs.writeFileSync('src/utils/minigame.ts', result, 'utf8');
console.log('Gacha patched. File is now', result.length, 'bytes');
