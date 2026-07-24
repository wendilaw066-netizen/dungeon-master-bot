import { EmbedBuilder } from 'discord.js';

export enum Season {
  SPRING = 0,
  SUMMER = 1,
  AUTUMN = 2,
  WINTER = 3
}

export function getCurrentSeason(): Season {
  // 1 day = 86400000 ms. Changes every day.
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return daysSinceEpoch % 4;
}

export function getSeasonInfo(season: Season) {
  switch (season) {
    case Season.SPRING:
      return { name: '🌸 Musim Semi (Spring)', desc: 'Cuaca sejuk dan menyenangkan. Normal yield.', emoji: '🌸' };
    case Season.SUMMER:
      return { name: '☀️ Musim Panas (Summer)', desc: 'Sinar matahari melimpah! Hasil Farm (Beras) meningkat +20%.', emoji: '☀️' };
    case Season.AUTUMN:
      return { name: '🍂 Musim Gugur (Autumn)', desc: 'Daun berguguran. Normal yield.', emoji: '🍂' };
    case Season.WINTER:
      return { name: '❄️ Musim Dingin (Winter)', desc: 'Badai salju membekukan sawah! Hasil Farm (Beras) menurun -50%.', emoji: '❄️' };
  }
}

export function getFarmSeasonMultiplier(): number {
  const season = getCurrentSeason();
  if (season === Season.SUMMER) return 1.2;
  if (season === Season.WINTER) return 0.5;
  return 1.0;
}

export async function checkSeasonTick(client?: any) {
  const current = getCurrentSeason();
  const info = getSeasonInfo(current);
  return info;
}
