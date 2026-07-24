import { PlayerInventory } from '../minigame';

export interface ActiveSkill {
  id: string;
  name: string;
  manaCost: number;
  baseDamageMultiplier: number;
  effect: 'damage' | 'lifesteal' | 'stun' | 'heal' | 'shield';
  description: string;
}

export const JOB_SKILLS: Record<string, ActiveSkill> = {
  'Novice': {
    id: 'novice_skill',
    name: 'Novice Hustle',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Fighter': {
    id: 'fighter_skill',
    name: 'Fighter Smash',
    manaCost: 30,
    baseDamageMultiplier: 2.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Warrior': {
    id: 'warrior_skill',
    name: 'Warrior Smash',
    manaCost: 30,
    baseDamageMultiplier: 2.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Swordsman': {
    id: 'swordsman_skill',
    name: 'Swordsman Smash',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'shield',
    description: 'Serangan yang juga memberikan pertahanan ekstra di ronde berikutnya.'
  },
  'Archer': {
    id: 'archer_skill',
    name: 'Archer Volley',
    manaCost: 30,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Gunner': {
    id: 'gunner_skill',
    name: 'Gunner Volley',
    manaCost: 30,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Thief': {
    id: 'thief_skill',
    name: 'Thief Volley',
    manaCost: 30,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Hunter': {
    id: 'hunter_skill',
    name: 'Hunter Volley',
    manaCost: 30,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Mage': {
    id: 'mage_skill',
    name: 'Mage Blast',
    manaCost: 30,
    baseDamageMultiplier: 3.2,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Cultist': {
    id: 'cultist_skill',
    name: 'Cultist Blast',
    manaCost: 30,
    baseDamageMultiplier: 1.5,
    effect: 'lifesteal',
    description: 'Mencuri HP musuh dan menyembuhkan dirimu.'
  },
  'Acolyte': {
    id: 'acolyte_skill',
    name: 'Acolyte Blast',
    manaCost: 30,
    baseDamageMultiplier: 3.2,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Cleric': {
    id: 'cleric_skill',
    name: 'Cleric Grace',
    manaCost: 30,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Bard': {
    id: 'bard_skill',
    name: 'Bard Grace',
    manaCost: 30,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Citizen': {
    id: 'citizen_skill',
    name: 'Citizen Hustle',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Medic': {
    id: 'medic_skill',
    name: 'Medic Hustle',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Gatherer': {
    id: 'gatherer_skill',
    name: 'Gatherer Hustle',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Leader': {
    id: 'leader_skill',
    name: 'Leader Hustle',
    manaCost: 30,
    baseDamageMultiplier: 2,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Knight': {
    id: 'knight_skill',
    name: 'Knight Smash',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'shield',
    description: 'Serangan yang juga memberikan pertahanan ekstra di ronde berikutnya.'
  },
  'Heavy Gunner': {
    id: 'heavy_gunner_skill',
    name: 'Heavy Gunner Smash',
    manaCost: 40,
    baseDamageMultiplier: 3,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Berserker': {
    id: 'berserker_skill',
    name: 'Berserker Smash',
    manaCost: 40,
    baseDamageMultiplier: 3,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Gladiator': {
    id: 'gladiator_skill',
    name: 'Gladiator Smash',
    manaCost: 40,
    baseDamageMultiplier: 3,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Magic Knight': {
    id: 'magic_knight_skill',
    name: 'Magic Knight Smash',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'shield',
    description: 'Serangan yang juga memberikan pertahanan ekstra di ronde berikutnya.'
  },
  'Sniper': {
    id: 'sniper_skill',
    name: 'Sniper Volley',
    manaCost: 40,
    baseDamageMultiplier: 3.5,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Machinist': {
    id: 'machinist_skill',
    name: 'Machinist Volley',
    manaCost: 40,
    baseDamageMultiplier: 3.5,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Assassin': {
    id: 'assassin_skill',
    name: 'Assassin Volley',
    manaCost: 40,
    baseDamageMultiplier: 3.5,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Ninja': {
    id: 'ninja_skill',
    name: 'Ninja Volley',
    manaCost: 40,
    baseDamageMultiplier: 3.5,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Beast Tamer': {
    id: 'beast_tamer_skill',
    name: 'Beast Tamer Volley',
    manaCost: 40,
    baseDamageMultiplier: 3.5,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Wizard': {
    id: 'wizard_skill',
    name: 'Wizard Blast',
    manaCost: 40,
    baseDamageMultiplier: 3.7,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Warlock': {
    id: 'warlock_skill',
    name: 'Warlock Blast',
    manaCost: 40,
    baseDamageMultiplier: 2,
    effect: 'lifesteal',
    description: 'Mencuri HP musuh dan menyembuhkan dirimu.'
  },
  'Astrologian': {
    id: 'astrologian_skill',
    name: 'Astrologian Blast',
    manaCost: 40,
    baseDamageMultiplier: 3.7,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Priest': {
    id: 'priest_skill',
    name: 'Priest Grace',
    manaCost: 40,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Enchanter': {
    id: 'enchanter_skill',
    name: 'Enchanter Grace',
    manaCost: 40,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Builder': {
    id: 'builder_skill',
    name: 'Builder Hustle',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Doctor': {
    id: 'doctor_skill',
    name: 'Doctor Hustle',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Farmer': {
    id: 'farmer_skill',
    name: 'Farmer Hustle',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Commander': {
    id: 'commander_skill',
    name: 'Commander Hustle',
    manaCost: 40,
    baseDamageMultiplier: 2.5,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Paladin': {
    id: 'paladin_skill',
    name: 'Paladin Smash',
    manaCost: 50,
    baseDamageMultiplier: 3,
    effect: 'shield',
    description: 'Serangan yang juga memberikan pertahanan ekstra di ronde berikutnya.'
  },
  'Juggernaut': {
    id: 'juggernaut_skill',
    name: 'Juggernaut Smash',
    manaCost: 50,
    baseDamageMultiplier: 3.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Warlord': {
    id: 'warlord_skill',
    name: 'Warlord Smash',
    manaCost: 50,
    baseDamageMultiplier: 3.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Blademaster': {
    id: 'blademaster_skill',
    name: 'Blademaster Smash',
    manaCost: 50,
    baseDamageMultiplier: 3.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Spellblade': {
    id: 'spellblade_skill',
    name: 'Spellblade Smash',
    manaCost: 50,
    baseDamageMultiplier: 3.5,
    effect: 'stun',
    description: 'Serangan brutal yang bisa membuat musuh pusing sesaat.'
  },
  'Phantom Bow': {
    id: 'phantom_bow_skill',
    name: 'Phantom Bow Volley',
    manaCost: 50,
    baseDamageMultiplier: 4,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Cyber-Gunslinger': {
    id: 'cyber-gunslinger_skill',
    name: 'Cyber-Gunslinger Volley',
    manaCost: 50,
    baseDamageMultiplier: 4,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Nightshade': {
    id: 'nightshade_skill',
    name: 'Nightshade Volley',
    manaCost: 50,
    baseDamageMultiplier: 4,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Void-Walker': {
    id: 'void-walker_skill',
    name: 'Void-Walker Volley',
    manaCost: 50,
    baseDamageMultiplier: 4,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Beastmaster': {
    id: 'beastmaster_skill',
    name: 'Beastmaster Volley',
    manaCost: 50,
    baseDamageMultiplier: 4,
    effect: 'damage',
    description: 'Hujan proyektil mematikan dengan damage sangat tinggi.'
  },
  'Archmage': {
    id: 'archmage_skill',
    name: 'Archmage Blast',
    manaCost: 50,
    baseDamageMultiplier: 4.2,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Dark Lord': {
    id: 'dark_lord_skill',
    name: 'Dark Lord Blast',
    manaCost: 50,
    baseDamageMultiplier: 4.2,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'Stellar Caster': {
    id: 'stellar_caster_skill',
    name: 'Stellar Caster Blast',
    manaCost: 50,
    baseDamageMultiplier: 4.2,
    effect: 'damage',
    description: 'Ledakan magis skala besar.'
  },
  'High Priest': {
    id: 'high_priest_skill',
    name: 'High Priest Grace',
    manaCost: 50,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Oracle': {
    id: 'oracle_skill',
    name: 'Oracle Grace',
    manaCost: 50,
    baseDamageMultiplier: 0,
    effect: 'heal',
    description: 'Menyembuhkan HP dalam jumlah besar seketika.'
  },
  'Master Architect': {
    id: 'master_architect_skill',
    name: 'Master Architect Hustle',
    manaCost: 50,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Master Surgeon': {
    id: 'master_surgeon_skill',
    name: 'Master Surgeon Hustle',
    manaCost: 50,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Master Harvester': {
    id: 'master_harvester_skill',
    name: 'Master Harvester Hustle',
    manaCost: 50,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
  'Emperor': {
    id: 'emperor_skill',
    name: 'Emperor Hustle',
    manaCost: 50,
    baseDamageMultiplier: 3,
    effect: 'damage',
    description: 'Serangan tak terduga dari pekerja keras.'
  },
};

export function getSkillForJob(jobName: string): ActiveSkill | null {
  return JOB_SKILLS[jobName] || null;
}

export function calculateSkillExpNeeded(level: number): number {
  return level * 100;
}
