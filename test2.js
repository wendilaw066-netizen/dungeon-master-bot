const db = require('./minigame-db.json');
const player = db['Anak Meiling'];
console.log('Town Land Slots:', player.town.landSlots);
console.log('Town Buildings:', player.town.buildings);

const BUILDING_COSTS = {
    house:        { slots: 1 },
    farm:         { slots: 1 },
    quarry:       { slots: 1 },
    lumberMill:   { slots: 1 },
    ranch:        { slots: 1 },
    tower:        { slots: 1 },
    hospital:     { slots: 1 },
    tavern:       { slots: 1 },
    school:       { slots: 1 },
    inn:          { slots: 1 },
    academy:      { slots: 1 },
    barrack:      { slots: 1 },
    stable:       { slots: 1 },
    smithy:       { slots: 1 },
    marketplace:  { slots: 1 },
    harbour:      { slots: 1 },
    workshop:     { slots: 1 },
    warehouse:    { slots: 1 },
    wonder:       { slots: 1 },
};

function usedSlots(town) {
  if (!town || !town.buildings) return 0;
  let used = 0;
  for (const bType in town.buildings) {
    const qty = town.buildings[bType] || 0;
    const cost = BUILDING_COSTS[bType];
    if (cost) used += (qty * cost.slots);
    else used += qty;
  }
  return used;
}
console.log('Used Slots:', usedSlots(player.town));
