import { PlayerInventory } from '../minigame';

export interface JobData {
  className: string;
  tier: number;
  category: 'Melee' | 'Ranged' | 'Magic' | 'Support' | 'Sandbox';
  description: string;
}

export const JOBS: Record<string, JobData> = {
  // Tier 1
  'Novice': { className: 'Novice', tier: 1, category: 'Sandbox', description: 'Pemula.' },
  'Fighter': { className: 'Fighter', tier: 1, category: 'Melee', description: 'Petarung jarak dekat dasar.' },
  'Warrior': { className: 'Warrior', tier: 1, category: 'Melee', description: 'Fokus serangan fisik.' },
  'Swordsman': { className: 'Swordsman', tier: 1, category: 'Melee', description: 'Petarung pedang.' },
  'Archer': { className: 'Archer', tier: 1, category: 'Ranged', description: 'Pemanah presisi.' },
  'Gunner': { className: 'Gunner', tier: 1, category: 'Ranged', description: 'Pengguna senjata api.' },
  'Thief': { className: 'Thief', tier: 1, category: 'Ranged', description: 'Pencuri yang gesit.' },
  'Hunter': { className: 'Hunter', tier: 1, category: 'Ranged', description: 'Pemburu hewan peliharaan.' },
  'Mage': { className: 'Mage', tier: 1, category: 'Magic', description: 'Pengguna sihir elemen.' },
  'Cultist': { className: 'Cultist', tier: 1, category: 'Magic', description: 'Pengikut ilmu hitam.' },
  'Acolyte': { className: 'Acolyte', tier: 1, category: 'Magic', description: 'Pelajar kosmis.' },
  'Cleric': { className: 'Cleric', tier: 1, category: 'Support', description: 'Penyembuh dasar.' },
  'Bard': { className: 'Bard', tier: 1, category: 'Support', description: 'Penyanyi pembawa buff.' },
  'Citizen': { className: 'Citizen', tier: 1, category: 'Sandbox', description: 'Penduduk biasa yang rajin.' },
  'Medic': { className: 'Medic', tier: 1, category: 'Sandbox', description: 'Perawat lapangan.' },
  'Gatherer': { className: 'Gatherer', tier: 1, category: 'Sandbox', description: 'Pengumpul sumber daya.' },
  'Leader': { className: 'Leader', tier: 1, category: 'Sandbox', description: 'Pemimpin kecil.' },

  // Tier 2 (Promote at Normal Chapter 3)
  'Knight': { className: 'Knight', tier: 2, category: 'Melee', description: 'Kesatria berzirah.' },
  'Heavy Gunner': { className: 'Heavy Gunner', tier: 2, category: 'Melee', description: 'Petarung jarak dekat berat.' },
  'Berserker': { className: 'Berserker', tier: 2, category: 'Melee', description: 'Petarung membabi buta.' },
  'Gladiator': { className: 'Gladiator', tier: 2, category: 'Melee', description: 'Petarung arena.' },
  'Magic Knight': { className: 'Magic Knight', tier: 2, category: 'Melee', description: 'Petarung sihir hibrida.' },
  'Sniper': { className: 'Sniper', tier: 2, category: 'Ranged', description: 'Penembak jitu mematikan.' },
  'Machinist': { className: 'Machinist', tier: 2, category: 'Ranged', description: 'Pakar mesin penyerang.' },
  'Assassin': { className: 'Assassin', tier: 2, category: 'Ranged', description: 'Pembunuh senyap.' },
  'Ninja': { className: 'Ninja', tier: 2, category: 'Ranged', description: 'Pengguna kelincahan tinggi.' },
  'Beast Tamer': { className: 'Beast Tamer', tier: 2, category: 'Ranged', description: 'Penjinak monster.' },
  'Wizard': { className: 'Wizard', tier: 2, category: 'Magic', description: 'Penyihir elemen andal.' },
  'Warlock': { className: 'Warlock', tier: 2, category: 'Magic', description: 'Pengguna kutukan.' },
  'Astrologian': { className: 'Astrologian', tier: 2, category: 'Magic', description: 'Pembaca rasi bintang.' },
  'Priest': { className: 'Priest', tier: 2, category: 'Support', description: 'Penyembuh andal.' },
  'Enchanter': { className: 'Enchanter', tier: 2, category: 'Support', description: 'Pemberi buff tim.' },
  'Builder': { className: 'Builder', tier: 2, category: 'Sandbox', description: 'Ahli bangunan.' },
  'Doctor': { className: 'Doctor', tier: 2, category: 'Sandbox', description: 'Dokter medis.' },
  'Farmer': { className: 'Farmer', tier: 2, category: 'Sandbox', description: 'Petani spesialis.' },
  'Commander': { className: 'Commander', tier: 2, category: 'Sandbox', description: 'Komandan pasukan.' },

  // Tier 3 (Promote at Nightmare Chapter 1)
  'Paladin': { className: 'Paladin', tier: 3, category: 'Melee', description: 'Pelindung suci.' },
  'Juggernaut': { className: 'Juggernaut', tier: 3, category: 'Melee', description: 'Zirah mekanik tak tertembus.' },
  'Warlord': { className: 'Warlord', tier: 3, category: 'Melee', description: 'Penguasa pertempuran brutal.' },
  'Blademaster': { className: 'Blademaster', tier: 3, category: 'Melee', description: 'Dewa pedang.' },
  'Spellblade': { className: 'Spellblade', tier: 3, category: 'Melee', description: 'Pemutus realitas.' },
  'Phantom Bow': { className: 'Phantom Bow', tier: 3, category: 'Ranged', description: 'Pemanah hantu.' },
  'Cyber-Gunslinger': { className: 'Cyber-Gunslinger', tier: 3, category: 'Ranged', description: 'Penembak masa depan.' },
  'Nightshade': { className: 'Nightshade', tier: 3, category: 'Ranged', description: 'Eksekutor mutlak.' },
  'Void-Walker': { className: 'Void-Walker', tier: 3, category: 'Ranged', description: 'Manipulator ruang.' },
  'Beastmaster': { className: 'Beastmaster', tier: 3, category: 'Ranged', description: 'Pemimpin kawanan.' },
  'Archmage': { className: 'Archmage', tier: 3, category: 'Magic', description: 'Dewa elemen.' },
  'Dark Lord': { className: 'Dark Lord', tier: 3, category: 'Magic', description: 'Raja kegelapan.' },
  'Stellar Caster': { className: 'Stellar Caster', tier: 3, category: 'Magic', description: 'Pengendali kosmis.' },
  'High Priest': { className: 'High Priest', tier: 3, category: 'Support', description: 'Pembangkit kehidupan.' },
  'Oracle': { className: 'Oracle', tier: 3, category: 'Support', description: 'Penyanyi ramalan.' },
  'Master Architect': { className: 'Master Architect', tier: 3, category: 'Sandbox', description: 'Perancang dunia.' },
  'Master Surgeon': { className: 'Master Surgeon', tier: 3, category: 'Sandbox', description: 'Ahli bedah organik.' },
  'Master Harvester': { className: 'Master Harvester', tier: 3, category: 'Sandbox', description: 'Raja panen.' },
  'Emperor': { className: 'Emperor', tier: 3, category: 'Sandbox', description: 'Penguasa tertinggi.' },
};

export function getJobBonusMultiplier(player: PlayerInventory): { hp: number; attack: number; farm: number } {
  const pJob = (player as any).job || { class: 'Novice', tier: 1 };
  const job = JOBS[pJob.class] || JOBS['Novice'];
  let hpMulti = 1;
  let atkMulti = 1;
  let farmMulti = 1;

  // Tier base modifier (Tier 1 = x1, Tier 2 = x1.5, Tier 3 = x2.5)
  const tierMod = job.tier === 1 ? 1 : job.tier === 2 ? 1.5 : 2.5;

  if (job.category === 'Melee') {
    hpMulti = 1.3 * tierMod;
    atkMulti = 1.0 * tierMod;
  } else if (job.category === 'Ranged' || job.category === 'Magic') {
    hpMulti = 0.8 * tierMod;
    atkMulti = 1.5 * tierMod;
  } else if (job.category === 'Support') {
    hpMulti = 1.2 * tierMod;
    atkMulti = 0.8 * tierMod;
  } else if (job.category === 'Sandbox') {
    hpMulti = 1.0 * tierMod;
    atkMulti = 1.0 * tierMod;
    farmMulti = 2.0 * tierMod; // Sandbox gets insane farming boosts
  }

  // Very specific Emperor bonus
  if (job.className === 'Emperor') {
    farmMulti *= 2; // Extra double passive income
  }

  return { hp: hpMulti, attack: atkMulti, farm: farmMulti };
}

export function handleJobCommand(player: PlayerInventory, args: string[]): string {
  const pJob = (player as any).job || { class: 'Novice', tier: 1 };
  if (args.length === 0) {
    return `ℹ️ Job kamu saat ini: **${pJob.class} (Tier ${pJob.tier})**\nKetik \`!job list\` untuk melihat daftar Job Tier 1, atau \`!job choose <nama_job>\` untuk berganti profesi.`;
  }
  
  const subCmd = args[0].toLowerCase();
  if (subCmd === 'list') {
    const tier1 = Object.values(JOBS).filter(j => j.tier === 1).map(j => `**${j.className}** (${j.category})`).join(', ');
    return `📜 **Daftar Job Dasar (Tier 1):**\n${tier1}\n\nKetik \`!job choose <nama>\` untuk memilih!`;
  }
  
  if (subCmd === 'choose') {
    const jobName = args.slice(1).join(' ').toLowerCase();
    const foundJob = Object.values(JOBS).find(j => j.className.toLowerCase() === jobName);
    
    if (!foundJob) return `Job "${jobName}" tidak ditemukan!`;
    
    // Syarat Tier
    if (foundJob.tier === 2) {
      if (player.dungeonProgress.difficulty < 1 && player.dungeonProgress.chapter < 3) {
        return `⚠️ Kamu belum cukup kuat untuk menjadi ${foundJob.className}! Syarat: Tamatkan Dungeon Normal Chapter 3.`;
      }
    } else if (foundJob.tier === 3) {
      if (player.dungeonProgress.difficulty < 2) {
        return `⚠️ Kamu belum cukup kuat untuk menjadi ${foundJob.className}! Syarat: Buka Dungeon Kesulitan Nightmare.`;
      }
    }
    
    (player as any).job = { class: foundJob.className, tier: foundJob.tier };
    return `✨ SELAMAT! Kamu telah berevolusi menjadi seorang **${foundJob.className} (Tier ${foundJob.tier} ${foundJob.category})**!`;
  }
  
  return `Perintah salah. Gunakan \`!job list\` atau \`!job choose <nama>\`.`;
}
