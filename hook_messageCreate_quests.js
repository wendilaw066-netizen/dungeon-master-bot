const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.ts', 'utf8');

const targetImport = `import { getDailyQuests } from '../utils/rpg/quests';`;
const replaceImport = `import { getDailyQuests, progressQuest } from '../utils/rpg/quests';`;
code = code.replace(targetImport, replaceImport);

const craftSearch = `        player.items.push(productName);
        message.reply(\`🛠️ Kamu berhasil melakukan craft **\${productName}**!\`).catch(()=>{});
        saveMinigameDB(db);`;

const craftReplace = `        player.items.push(productName);
        progressQuest(player, 'craft', 1);
        message.reply(\`🛠️ Kamu berhasil melakukan craft **\${productName}**!\`).catch(()=>{});
        saveMinigameDB(db);`;
code = code.replace(craftSearch, craftReplace);

const auctionSearch = `          globalAuctionData.push(listing);
          saveMinigameDB(db);

          message.reply(\`📈 Item **\${itemName}** milikmu berhasil didaftarkan ke Auction House seharga **\${price} WL**.\`).catch(()=>{});`;

const auctionReplace = `          globalAuctionData.push(listing);
          progressQuest(player, 'sell_auction', 1);
          saveMinigameDB(db);

          message.reply(\`📈 Item **\${itemName}** milikmu berhasil didaftarkan ke Auction House seharga **\${price} WL**.\`).catch(()=>{});`;
code = code.replace(auctionSearch, auctionReplace);

fs.writeFileSync('src/events/messageCreate.ts', code, 'utf8');
console.log('Hooked quests in messageCreate');
