const fs = require('fs');
const path = require('path');

const jobsContent = fs.readFileSync(path.join(__dirname, 'src/utils/rpg/jobs.ts'), 'utf8');

const jobNames = [];
const regex = /'([A-Za-z0-9\s\-]+)':\s*{\s*className:\s*'([A-Za-z0-9\s\-]+)',\s*tier:\s*(\d+),\s*category:\s*'([A-Za-z]+)'/g;
let match;
while ((match = regex.exec(jobsContent)) !== null) {
  jobNames.push({ name: match[1], tier: parseInt(match[3]), category: match[4] });
}

let skillsCode = "import { PlayerInventory } from '../minigame';\n\n" +
"export interface ActiveSkill {\n" +
"  id: string;\n" +
"  name: string;\n" +
"  manaCost: number;\n" +
"  baseDamageMultiplier: number;\n" +
"  effect: 'damage' | 'lifesteal' | 'stun' | 'heal' | 'shield';\n" +
"  description: string;\n" +
"}\n\n" +
"export const JOB_SKILLS: Record<string, ActiveSkill> = {\n";

function generateSkillForJob(job) {
  const t = job.tier;
  const c = job.category;
  
  let effect = 'damage';
  let dmgMult = 1.5 + (t * 0.5); 
  let mana = 20 + (t * 10);
  let skillName = job.name + ' Strike';
  let desc = 'Serangan kuat.';
  
  if (c === 'Melee') {
    skillName = job.name + ' Smash';
    if (job.name.includes('Sword') || job.name.includes('Knight') || job.name.includes('Paladin')) {
      effect = 'shield';
      desc = 'Serangan yang juga memberikan pertahanan ekstra di ronde berikutnya.';
    } else {
      effect = 'stun';
      desc = 'Serangan brutal yang bisa membuat musuh pusing sesaat.';
      dmgMult += 0.5;
    }
  } else if (c === 'Ranged') {
    skillName = job.name + ' Volley';
    effect = 'damage';
    dmgMult += 1.0; 
    desc = 'Hujan proyektil mematikan dengan damage sangat tinggi.';
  } else if (c === 'Magic') {
    skillName = job.name + ' Blast';
    if (job.name.includes('Cultist') || job.name.includes('Necro') || job.name.includes('Warlock') || job.name.includes('Blood')) {
      effect = 'lifesteal';
      desc = 'Mencuri HP musuh dan menyembuhkan dirimu.';
      dmgMult -= 0.5;
    } else {
      effect = 'damage';
      dmgMult += 1.2;
      desc = 'Ledakan magis skala besar.';
    }
  } else if (c === 'Support') {
    skillName = job.name + ' Grace';
    effect = 'heal';
    dmgMult = 0; 
    desc = 'Menyembuhkan HP dalam jumlah besar seketika.';
  } else if (c === 'Sandbox') {
    skillName = job.name + ' Hustle';
    effect = 'damage';
    desc = 'Serangan tak terduga dari pekerja keras.';
  }

  const id = job.name.toLowerCase().replace(/\s+/g, '_') + '_skill';

  return "  '" + job.name + "': {\n" +
         "    id: '" + id + "',\n" +
         "    name: '" + skillName + "',\n" +
         "    manaCost: " + mana + ",\n" +
         "    baseDamageMultiplier: " + dmgMult + ",\n" +
         "    effect: '" + effect + "',\n" +
         "    description: '" + desc + "'\n" +
         "  },";
}

jobNames.forEach(job => {
  skillsCode += generateSkillForJob(job) + "\n";
});

skillsCode += "};\n\n" +
"export function getSkillForJob(jobName: string): ActiveSkill | null {\n" +
"  return JOB_SKILLS[jobName] || null;\n" +
"}\n\n" +
"export function calculateSkillExpNeeded(level: number): number {\n" +
"  return level * 100;\n" +
"}\n";

fs.writeFileSync(path.join(__dirname, 'src/utils/rpg/skills.ts'), skillsCode, 'utf8');
console.log('skills.ts generated successfully with ' + jobNames.length + ' unique skills!');
