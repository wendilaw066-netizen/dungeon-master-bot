const fs = require('fs');
let code = fs.readFileSync('src/utils/rpg/quests.ts', 'utf8');

code = code.replace(/\\\\\`/g, '\`');
code = code.replace(/\\\\\$/g, '\$');

// For specific lines:
code = code.replace(/description: \\\`\\\\\${q.text} \(\\\\\${target}x\)\\\`/g, "description: `${q.text} (${target}x)`");
code = code.replace(/claimedText = \\\`\\\\n\\\\n🎉 \*\*SELAMAT!\*\* Kamu mengklaim \*\*\\\\\${gemsClaimed} Gems\*\* dari quest yang selesai hari ini!\\\`/g, "claimedText = `\\n\\n🎉 **SELAMAT!** Kamu mengklaim **${gemsClaimed} Gems** dari quest yang selesai hari ini!`");
code = code.replace(/text \+= \\\`\*\*\\\\\${idx\+1}.\*\* \\\\\${icon} \\\\\${q.description} \(\\\\\${q.progress}\/\\\\\${q.target}\)\\\\n\\\`/g, "text += `**${idx+1}.** ${icon} ${q.description} (${q.progress}/${q.target})\\n`");

fs.writeFileSync('src/utils/rpg/quests.ts', code, 'utf8');
