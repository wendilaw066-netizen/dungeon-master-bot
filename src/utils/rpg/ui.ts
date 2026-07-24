import { EmbedBuilder } from 'discord.js';

// ============================================================
// THEME COLORS
// ============================================================
export const COLORS = {
  TAVERN:       0xAA6C39 as const, // Warm amber/wood
  SHOP:         0xF0A500 as const, // Merchant gold
  INVENTORY:    0x7B2D8B as const, // Royal purple
  DUNGEON_WIN:  0xFFD700 as const, // Radiant gold
  DUNGEON_LOSE: 0x1A0000 as const, // Blood dark
  FARM:         0x27AE60 as const, // Nature green
  BANK_WARN:    0xFF4444 as const, // Danger red
  TRADE:        0x1ABC9C as const, // Teal
  SUCCESS:      0x2ECC71 as const, // Bright green
  INFO:         0x5865F2 as const, // Discord blurple
  BOSS:         0x8B0000 as const, // Boss dark red
};

// ============================================================
// PROGRESS BAR BUILDERS
// ============================================================
export function hpBar(current: number, max: number, len = 14): string {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = Math.round(pct * len);
  const bar = '█'.repeat(filled) + '░'.repeat(len - filled);
  const icon = pct > 0.6 ? '💚' : pct > 0.3 ? '💛' : '❤️';
  return `${icon} \`${bar}\` **${Math.floor(current)} / ${max}**`;
}

export function xpBar(current: number, max: number, len = 14): string {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = Math.round(pct * len);
  const bar = '▰'.repeat(filled) + '▱'.repeat(len - filled);
  return `✨ \`${bar}\` ${current}/${max}`;
}

export function durBar(dur: number, len = 10): string {
  const pct = dur / 100;
  const filled = Math.round(pct * len);
  const bar = '■'.repeat(filled) + '□'.repeat(len - filled);
  const icon = dur > 60 ? '🟢' : dur > 30 ? '🟡' : '🔴';
  return `${icon}\`${bar}\` ${dur}%`;
}

export function progressStars(current: number, max: number): string {
  const filled = Math.min(current, max);
  return '⭐'.repeat(filled) + '☆'.repeat(Math.max(0, max - filled));
}

// ============================================================
// NUMBER FORMATTING
// ============================================================
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('id-ID');
}

export function wealthLine(gems: number, coins: number, dls: number, bgls: number): string {
  const parts: string[] = [];
  if (bgls > 0) parts.push(`🔵 **${bgls}** BGL`);
  if (dls  > 0) parts.push(`💎 **${dls}** DL`);
  parts.push(`🔒 **${fmt(coins)}** Coin`);
  parts.push(`💠 **${fmt(gems)}** Gems`);
  return parts.join('  •  ');
}

// ============================================================
// SEPARATOR / DECORATION
// ============================================================
export const THIN_LINE  = '─'.repeat(34);
export const THICK_LINE = '═'.repeat(34);

export function sectionHeader(icon: string, title: string): string {
  return `${icon} **${title}**`;
}
