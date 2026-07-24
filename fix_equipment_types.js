const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/equipment.ts', 'utf8');

const targetImport = `import { getJobBonusMultiplier } from './jobs';`;
const replaceImport = `import { getJobBonusMultiplier } from './jobs';\nimport { loadGuilds } from './guilds';`;
code = code.replace(targetImport, replaceImport);

const targetNullCheck = `  let requiredMaterial = 'Wood';
  if (eq.name.toLowerCase().includes('iron') || eq.name.toLowerCase().includes('sword') || eq.name.toLowerCase().includes('armor')) requiredMaterial = 'Iron Ore';
  if (eq.name.toLowerCase().includes('magic') || eq.name.toLowerCase().includes('staff') || eq.name.toLowerCase().includes('robe')) requiredMaterial = 'Magic Dust';
  if (eq.name.toLowerCase().includes('dragon') || eq.name.toLowerCase().includes('excalibur')) requiredMaterial = 'Dragon Scale';`;

const replaceNullCheck = `  let requiredMaterial = 'Wood';
  const n = eq.name?.toLowerCase() || '';
  if (n.includes('iron') || n.includes('sword') || n.includes('armor')) requiredMaterial = 'Iron Ore';
  if (n.includes('magic') || n.includes('staff') || n.includes('robe')) requiredMaterial = 'Magic Dust';
  if (n.includes('dragon') || n.includes('excalibur')) requiredMaterial = 'Dragon Scale';`;

code = code.replace(targetNullCheck, replaceNullCheck);

fs.writeFileSync('src/utils/rpg/equipment.ts', code, 'utf8');
