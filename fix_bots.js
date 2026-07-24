const fs = require('fs');
const db = JSON.parse(fs.readFileSync('./minigame-db.json', 'utf8'));

let updated = 0;
for (const userId in db) {
    if (db[userId].autoPlayActive && db[userId].town) {
        db[userId].coins += 500;
        if (db[userId].town.landSlots < 5) {
            db[userId].town.landSlots = 5;
        }
        updated++;
    }
}

fs.writeFileSync('./minigame-db.json', JSON.stringify(db, null, 2));
console.log("Updated " + updated + " bots with 500 coins and minimum 5 land slots.");
