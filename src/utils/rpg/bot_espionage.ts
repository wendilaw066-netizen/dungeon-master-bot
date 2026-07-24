import { loadMinigameDB, saveMinigameDB, PlayerInventory } from '../minigame';
import { getPlayer } from '../minigame';
import { pushDashboardLog } from './dashboard';

/**
 * 🕵️ Espionage System
 * Scans human players in the database and identifies targets
 * based on wealth-to-army ratio. Generates intel reports for bots.
 */
export function runEspionage(db: any, client: any): string[] {
  const intelReports: string[] = [];
  
  // Find all human players (players without isBot flag)
  const humans: { id: string; wealth: number; defense: number; name: string }[] = [];
  
  for (const userId in db.players) {
    const p: PlayerInventory = db.players[userId];
    if (p.isAuto || p.autoPlayActive) continue; // Only spy on humans
    
    // Estimate wealth
    const coins = p.coins || 0;
    const items = (p.materials?.['Iron'] || 0) + (p.materials?.['Wood'] || 0);
    const wealth = coins + (items * 0.2); // Rough estimation
    
    // Estimate defense
    const infantry = p.town?.army?.infantry || 0;
    const archers = p.town?.army?.archers || 0;
    const cavalry = p.town?.army?.cavalry || 0;
    const defense = infantry + (archers * 1.5) + (cavalry * 2.0);
    
    // Attempt to get name from discord client if possible, else fallback
    const user = client?.users?.cache?.get(userId);
    const name = user ? user.username : `Player_${userId.substring(0,4)}`;
    
    humans.push({ id: userId, wealth, defense, name });
  }
  
  // Sort humans by Wealth/Defense ratio (highest first)
  // To avoid division by zero, use Math.max(1, defense)
  humans.sort((a, b) => (b.wealth / Math.max(1, b.defense)) - (a.wealth / Math.max(1, a.defense)));
  
  // Generate reports for the top 2 juiciest targets
  for (let i = 0; i < Math.min(2, humans.length); i++) {
    const target = humans[i];
    if (target.wealth > 100) {
      if (target.defense < 10) {
         intelReports.push(`🕵️ **INTEL SPY:** Pemain **${target.name}** memiliki ${Math.floor(target.wealth)} kekayaan dengan pertahanan SANGAT LEMAH! Sasaran empuk untuk di-raid!`);
      } else {
         intelReports.push(`🕵️ **INTEL SPY:** Pemain **${target.name}** menimbun harta sebesar ${Math.floor(target.wealth)} namun dijaga oleh ${target.defense} tentara.`);
      }
      
      // Update target status in DB for Warlords to hunt (optional advanced integration)
      if (!db.globalState) db.globalState = {};
      if (!db.globalState.hitlist) db.globalState.hitlist = [];
      
      const exists = db.globalState.hitlist.find((h: any) => h.id === target.id);
      if (!exists) {
        db.globalState.hitlist.push({ id: target.id, name: target.name, bounty: 0 });
      }
    }
  }
  
  saveMinigameDB(db);
  return intelReports;
}
