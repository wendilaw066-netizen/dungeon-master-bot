const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const oldBlock = `    if (minigameCmd === '!jual' || (minigameCmd === '!shop' && (minigameArgs[1] === 'sell' || minigameArgs[1] === 'jual'))) {
      const query = minigameCmd === '!jual' ? minigameArgs.slice(1).join(' ') : minigameArgs.slice(2).join(' ');
      if (!query) {
        message.reply('❌ Masukkan nama item! Contoh: \`!jual angel wings\`\\nGunakan \`!inv gt\` atau \`!inv\` untuk lihat daftar item yang kamu miliki.').catch(() => {});
        return;
      }
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);`;

const newBlock = `    if (minigameCmd === '!jual' || (minigameCmd === '!shop' && (minigameArgs[1] === 'sell' || minigameArgs[1] === 'jual'))) {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const query = minigameCmd === '!jual' ? minigameArgs.slice(1).join(' ') : minigameArgs.slice(2).join(' ');
      
      if (!query) {
        const { EmbedBuilder } = require('discord.js');
        const e = new EmbedBuilder().setColor(0x3498DB).setTitle('📦 Barang yang Bisa Dijual');
        let text = 'Gunakan \`!jual <nama barang>\` atau \`!shop sell <nama>\`\\n\\n';
        
        let hasItem = false;
        if (p.items && p.items.length > 0) {
          text += '**🗡️ Equipment & Senjata:**\\n' + p.items.map((i: any) => \`- \${i}\`).join('\\n') + '\\n\\n';
          hasItem = true;
        }
        if (p.gtItems && p.gtItems.length > 0) {
          text += '**💎 GT Items:**\\n' + p.gtItems.map((i: any) => \`- \${i}\`).join('\\n') + '\\n\\n';
          hasItem = true;
        }
        
        if (!hasItem) {
          text += '*Kamu tidak memiliki barang yang bisa dijual saat ini.*';
        }
        
        e.setDescription(text);
        message.reply({ embeds: [e] }).catch(() => {});
        return;
      }`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/events/messageCreate.ts', code);
console.log('Done');
