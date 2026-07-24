import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../logger';

const WORLD_DB_PATH = path.join(process.cwd(), 'world-db.json');

export interface RegionData {
  id: string;
  name: string;
  controller: string | null; // Faction ID or player ID
  resourceBonus: string; // 'gems', 'mysticWood', 'coins'
  x: number;
  y: number;
  defenders: number; // For sieges
}

export interface FactionData {
  id: string;
  name: string;
  ideology: number; // -100 to 100
  resources: number;
  relations: Record<string, number>;
  state: 'PEACE' | 'WAR' | 'CRISIS';
}

export interface WorldDB {
  regions: Record<string, RegionData>;
  factions: Record<string, FactionData>;
  rulingFaction?: string | null;
}

let memoryWorld: WorldDB | null = null;
let saveWorldTimeout: NodeJS.Timeout | null = null;

export function loadWorldDB(): WorldDB {
  if (memoryWorld) return memoryWorld;
  
  try {
    if (fs.existsSync(WORLD_DB_PATH)) {
      memoryWorld = JSON.parse(fs.readFileSync(WORLD_DB_PATH, 'utf-8'));
      return memoryWorld!;
    }
  } catch(e) {
    logger.error('Failed to load world DB', 'World');
  }

  // Seed default world
  memoryWorld = {
    regions: {
      'cap1': { id: 'cap1', name: 'Luoyang (Capital)', controller: 'Wei', resourceBonus: 'gems', x: 0, y: -10, defenders: 50000 },
      'cap2': { id: 'cap2', name: 'Chang\'an', controller: 'Wei', resourceBonus: 'mysticWood', x: -15, y: -5, defenders: 35000 },
      'cap3': { id: 'cap3', name: 'Jianye', controller: 'Wu', resourceBonus: 'coins', x: 25, y: 15, defenders: 40000 },
      'cap4': { id: 'cap4', name: 'Chengdu', controller: 'Shu', resourceBonus: 'mysticWood', x: -20, y: 20, defenders: 45000 },
    },
    factions: {
      'Wei': { id: 'Wei', name: 'Cao Wei', ideology: 80, resources: 10000, relations: {}, state: 'PEACE' },
      'Shu': { id: 'Shu', name: 'Shu Han', ideology: -50, resources: 8000, relations: {}, state: 'PEACE' },
      'Wu': { id: 'Wu', name: 'Eastern Wu', ideology: 10, resources: 9000, relations: {}, state: 'PEACE' },
    },
    rulingFaction: null
  };
  saveWorldDB(memoryWorld);
  return memoryWorld;
}

export function saveWorldDB(db: WorldDB) {
  memoryWorld = db;
  if (!saveWorldTimeout) {
    saveWorldTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(WORLD_DB_PATH, JSON.stringify(memoryWorld, null, 2), 'utf-8');
      } catch(e){}
      saveWorldTimeout = null;
    }, 5000);
  }
}

// Logic: Relasi Akhir = (IDE * 1.2) - (BF * 1.5) - (RS * 2.0)
export function simulateFactionTick(db: WorldDB): string[] {
  const logs: string[] = [];
  const factions = Object.values(db.factions);
  const regions = Object.values(db.regions);
  
  for (const f1 of factions) {
    const f1Territory = regions.filter(r => r.controller === f1.id).length;
    for (const f2 of factions) {
      if (f1.id === f2.id) continue;

      // Calculate Border Friction (Shared borders theoretically, here we use region count proximity)
      let borderFriction = 0;
      const f2Territory = regions.filter(r => r.controller === f2.id).length;
      if (f1Territory > 0 && f2Territory > 0) borderFriction = 10; // simplified
      
      const ideDiff = Math.abs(f1.ideology - f2.ideology);
      const ideBonus = 100 - ideDiff; // higher means similar
      
      const resourceScarcity = f1.resources < 500 ? 20 : 0;
      
      const relasi = (ideBonus * 1.2) - (borderFriction * 1.5) - (resourceScarcity * 2.0);
      f1.relations[f2.id] = Math.max(-100, Math.min(100, Math.floor(relasi)));
      
      // War logic
      if (f1.relations[f2.id] < -50 && f1.state === 'PEACE' && f2.state !== 'CRISIS') {
        if (f1.resources > f2.resources) { // Threat Level check
          f1.state = 'WAR';
          f2.state = 'WAR';
          
          // Invade a region
          const targetRegions = regions.filter(r => r.controller === f2.id);
          if (targetRegions.length > 0) {
            const targetRegion = targetRegions[0];
            targetRegion.controller = f1.id;
            f1.resources -= 500;
            f2.resources -= 300;
            logs.push(`⚔️ **${f1.name}** menyatakan perang terhadap **${f2.name}** dan berhasil merebut region **${targetRegion.name}**!`);
          }
        }
      }
    }

    // Civil war check
    if (f1Territory > Math.floor(regions.length * 0.4)) {
       f1.state = 'CRISIS';
       const lostRegions = regions.filter(r => r.controller === f1.id);
       if (lostRegions.length > 0) {
          const revolt = lostRegions[lostRegions.length - 1];
          revolt.controller = null; // Rebels
          f1.resources -= 1000;
          logs.push(`🔥 PEMBERONTAKAN! Karena wilayah terlalu luas, rakyat di **${revolt.name}** menolak tunduk pada **${f1.name}**!`);
       }
    }
  }

  saveWorldDB(db);
  return logs;
}
