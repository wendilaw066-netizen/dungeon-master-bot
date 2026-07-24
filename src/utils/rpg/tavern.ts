import { EmbedBuilder } from 'discord.js';
import { MinigameDB, PlayerInventory, getPlayer, saveMinigameDB } from '../minigame';
import { COLORS, hpBar, fmt } from './ui';

// ============================================================
// TAVERN CONFIG
// ============================================================
const TAVERN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

interface TavernDrink {
  name: string;
  emoji: string;
  cost: number;
  unit: 'gems' | 'coins';
  desc: string;
  healPct?: number;   // Heal % of maxHp
  fullHeal?: boolean;
}

const DRINKS: Record<string, TavernDrink> = {
  ale: {
    name: 'Ale',       emoji: '🍺', cost: 500,  unit: 'gems',
    desc: 'Pulihkan **25% HP**. Minuman andalan para petualang.',
    healPct: 0.25,
  },
  mead: {
    name: 'Mead',      emoji: '🍯', cost: 1500, unit: 'gems',
    desc: 'Pulihkan **50% HP**. Minuman dari Utara yang menghangatkan jiwa.',
    healPct: 0.5,
  },
  elixir: {
    name: 'Elixir',    emoji: '⚗️', cost: 3,    unit: 'coins',
    desc: 'Pulihkan **100% HP**. Ramuan ajaib langka buatan alchemist terbaik.',
    fullHeal: true,
  },
};

const MONSTER_TAVERN_LORE = [
  '*"Kemarin ada Paladin yang mati di dungeon level 3... cerita yang menyedihkan."* — Barkeep',
  '*"Katanya ada naga yang bersarang di bawah kastil tua itu."* — Petualang Mabuk',
  '*"Hati-hati di Torment Mode, Sobat. Tidak ada yang pernah kembali utuh."* — Ksatria Tua',
  '*"Coin itu segalanya di dunia ini. Tanpa Coin, kamu bukan siapa-siapa."* — Merchant',
  '*"Dungeon itu ibarat karir. Semakin dalam, semakin besar resikonya."* — Si Bijak',
];

// ============================================================
// SHOW TAVERN MENU
// ============================================================
export function handleTavernMenu(db: MinigameDB, player: PlayerInventory): { embeds: EmbedBuilder[] } {
  const lore = MONSTER_TAVERN_LORE[Math.floor(Math.random() * MONSTER_TAVERN_LORE.length)];

  const drinksList = Object.entries(DRINKS).map(([key, d]) => {
    const price = d.unit === 'gems' ? `${fmt(d.cost)} Gems` : `${d.cost} Coin`;
    return `${d.emoji} **${d.name}** — *${price}*\n └ ${d.desc}`;
  }).join('\n\n');

  const lastRest = (player as any).tavernRestAt ?? 0;
  const cooldownLeft = Math.max(0, TAVERN_COOLDOWN_MS - (Date.now() - lastRest));
  const restStatus = cooldownLeft > 0
    ? `⏳ Cooldown: **${Math.ceil(cooldownLeft / 60000)} menit lagi**`
    : `✅ **Siap digunakan!** (Pulihkan 30% HP gratis)`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.TAVERN)
    .setTitle('🏚️  THE RUSTY CROWN  🏚️')
    .setDescription(
      `*Pintu kayu berderit. Asap perapian, tawa prajurit, dan aroma bir menyambutmu...*\n\n` +
      `> ${lore}\n\n` +
      `\`\`\`\n` +
      ` ╔══════════════════════════╗\n` +
      ` ║   SELAMAT DATANG, SOBAT  ║\n` +
      ` ║    Apa yang kau inginkan? ║\n` +
      ` ╚══════════════════════════╝\n` +
      `\`\`\``
    )
    .addFields(
      {
        name: '❤️  Kondisimu Sekarang',
        value: hpBar(player.hp, player.maxHp),
        inline: false,
      },
      {
        name: '🛏️  Istirahat di Kasur Tavern',
        value: restStatus,
        inline: false,
      },
      {
        name: '🍻  Menu Minuman Barkeep',
        value: drinksList,
        inline: false,
      },
      {
        name: '📋  Papan Pengumuman',
        value: '`!tavern board` — Lihat leaderboard kekayaan server',
        inline: false,
      }
    )
    .setFooter({
      text: '!tavern rest  •  !tavern drink <ale/mead/elixir>  •  !tavern board',
    })
    .setTimestamp();

  return { embeds: [embed] };
}

// ============================================================
// TAVERN REST (Free Heal, 1h Cooldown)
// ============================================================
export function handleTavernRest(db: MinigameDB, player: PlayerInventory, userId: string): { embeds: EmbedBuilder[] } {
  const now = Date.now();
  const lastRest = (player as any).tavernRestAt ?? 0;
  const cooldownLeft = Math.max(0, TAVERN_COOLDOWN_MS - (now - lastRest));

  if (cooldownLeft > 0) {
    const minsLeft = Math.ceil(cooldownLeft / 60000);
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('😴  Kamu Belum Cukup Lelah...')
      .setDescription(`Barkeep menggelengkan kepala.\n> *"Kamu baru saja istirahat tadi! Balik lagi dalam **${minsLeft} menit** ya, Sobat."*`)
      .setFooter({ text: 'Cooldown istirahat: 1 jam' });
    return { embeds: [embed] };
  }

  const healAmt = Math.floor(player.maxHp * 0.30);
  const oldHp = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + healAmt);
  (player as any).tavernRestAt = now;
  saveMinigameDB(db);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🛏️  Istirahat yang Menyenangkan!')
    .setDescription(
      `Kamu berbaring di kasur tavern yang hangat...\n` +
      `*Waktu berlalu. Kamu terbangun dengan segar!*\n\n` +
      `> *"Bayar nanti saja, Sobat. Semangat di dungeon!"* — Barkeep`
    )
    .addFields(
      { name: '❤️  HP Dipulihkan', value: `+**${player.hp - oldHp} HP** (${oldHp} → **${player.hp}**)`, inline: true },
      { name: '🛌  Status Baru', value: hpBar(player.hp, player.maxHp), inline: false },
    )
    .setFooter({ text: 'Cooldown istirahat berikutnya: 1 jam' })
    .setTimestamp();

  return { embeds: [embed] };
}

// ============================================================
// TAVERN DRINK
// ============================================================
export function handleTavernDrink(
  db: MinigameDB, player: PlayerInventory, userId: string, drinkKey: string
): { embeds: EmbedBuilder[] } {
  const drink = DRINKS[drinkKey.toLowerCase()];
  if (!drink) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle('❓  Minuman Tidak Ada')
      .setDescription(`Barkeep mengangkat alis.\n> *"Itu tidak ada di menu kami, Sobat."*\n\nPilihan: **ale**, **mead**, **elixir**`)
      .setFooter({ text: '!tavern drink ale | mead | elixir' });
    return { embeds: [embed] };
  }

  // Check can afford
  if (drink.unit === 'gems' && player.gems < drink.cost) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle(`${drink.emoji}  Dompetmu Tipis!`)
      .setDescription(`> *"Maaf Sobat, kamu kurang Gems. Cari duit dulu ya!"*\n\nButuh: **${fmt(drink.cost)} Gems** | Kamu punya: **${fmt(player.gems)} Gems**`);
    return { embeds: [embed] };
  }
  if (drink.unit === 'coins' && player.coins < drink.cost) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.BANK_WARN)
      .setTitle(`${drink.emoji}  Dompetmu Tipis!`)
      .setDescription(`> *"Kurang Coin, Sobat. Farming dulu!"*\n\nButuh: **${drink.cost} Coin** | Kamu punya: **${player.coins} Coin**`);
    return { embeds: [embed] };
  }

  // Deduct cost
  if (drink.unit === 'gems') player.gems -= drink.cost;
  else player.coins -= drink.cost;

  // Apply effect
  const oldHp = player.hp;
  if (drink.fullHeal) {
    player.hp = player.maxHp;
  } else if (drink.healPct) {
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * drink.healPct));
  }
  saveMinigameDB(db);

  const healed = player.hp - oldHp;
  const price = drink.unit === 'gems' ? `${fmt(drink.cost)} Gems` : `${drink.cost} Coin`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${drink.emoji}  Menenggak ${drink.name}!`)
    .setDescription(
      `Kamu meneguk ${drink.name} dalam satu tegukan.\n` +
      `*Hangat mengalir di tenggorokan... tenagamu kembali!*\n\n` +
      `> *"Kelihatannya enak! Minumlah sampai habis, Sobat!"* — Barkeep`
    )
    .addFields(
      { name: '❤️  HP Dipulihkan', value: `+**${healed} HP** (${oldHp} → **${player.hp}**)`, inline: true },
      { name: '💰  Dibayar', value: price, inline: true },
      { name: '📊  HP Sekarang', value: hpBar(player.hp, player.maxHp), inline: false },
    )
    .setTimestamp();

  return { embeds: [embed] };
}

// ============================================================
// TAVERN LEADERBOARD
// ============================================================
export function handleTavernBoard(db: MinigameDB, userId: string): { embeds: EmbedBuilder[] } {
  // Calculate net worth for each player: gems + coins*2000 + dls*200000 + bgls*20000000
  const entries = Object.entries(db)
    .filter(([, p]) => p && p.gems !== undefined)
    .map(([id, p]) => {
      const netWorth = (p.gems || 0) + (p.coins || 0) * 2000 + (0 || 0) * 200000 + (0 || 0) * 20000000;
      return { id, netWorth, gems: p.gems || 0, coins: p.coins || 0, dls: 0 || 0, job: p.job?.class || 'Novice' };
    })
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 10);

  const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  const board = entries.length === 0
    ? '*Belum ada petualang yang terdaftar...*'
    : entries.map((e, i) => {
        const mark = e.id === userId ? ' **← KAMU**' : '';
        return `${MEDALS[i]} \`${e.id.slice(0, 8)}...\` *(${e.job})* — **${fmt(e.netWorth)} Gems** net worth${mark}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.SHOP)
    .setTitle('🏆  PAPAN KETENARAN  —  The Rusty Crown')
    .setDescription(
      `*Nama-nama petualang terkaya di papan ini menjadi legenda...*\n\n` +
      board
    )
    .setFooter({ text: 'Net worth = Gems + Coin×2000 + DL×200K + BGL×20M' })
    .setTimestamp();

  return { embeds: [embed] };
}
