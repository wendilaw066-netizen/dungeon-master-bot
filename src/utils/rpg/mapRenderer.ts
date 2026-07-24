import { createCanvas } from 'canvas';
import { getTileType } from './map';

const TILE_SIZE = 50; // Increased for more detail
const RADIUS = 4; // 9x9 grid
const MAP_SIZE = (RADIUS * 2 + 1) * TILE_SIZE;

// Helper for seeded random to ensure tiles look consistent
function seededRandom(x: number, y: number, seed: number = 0) {
  let val = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return val - Math.floor(val);
}

export async function generateMapImage(viewX: number, viewY: number, px: number, py: number, otherPlayers: any[]): Promise<Buffer> {
  const canvas = createCanvas(MAP_SIZE, MAP_SIZE);
  const ctx = canvas.getContext('2d');

  // Draw base tiles
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const cx = viewX + dx;
      const cy = viewY + dy;
      
      const type = getTileType(cx, cy);
      const drawX = (dx + RADIUS) * TILE_SIZE;
      const drawY = (dy + RADIUS) * TILE_SIZE;
      
      // Base Biome Color
      if (type === 'plains') {
        ctx.fillStyle = '#6ab04c';
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        // Draw grass tufts
        ctx.strokeStyle = '#badc58';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const rx = drawX + 5 + seededRandom(cx, cy, i) * (TILE_SIZE - 10);
          const ry = drawY + 5 + seededRandom(cx, cy, i + 10) * (TILE_SIZE - 10);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry - 4);
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + 3, ry - 4);
          ctx.stroke();
        }
      } else if (type === 'forest') {
        ctx.fillStyle = '#44bd32';
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        // Draw clusters of trees
        const numTrees = Math.floor(seededRandom(cx, cy, 1) * 3) + 4;
        for (let i = 0; i < numTrees; i++) {
          const rx = drawX + 8 + seededRandom(cx, cy, i + 20) * (TILE_SIZE - 16);
          const ry = drawY + 8 + seededRandom(cx, cy, i + 30) * (TILE_SIZE - 16);
          // Tree shadow
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.arc(rx + 2, ry + 2, 7, 0, Math.PI * 2);
          ctx.fill();
          // Tree body
          ctx.fillStyle = '#009432';
          ctx.beginPath();
          ctx.arc(rx, ry, 7, 0, Math.PI * 2);
          ctx.fill();
          // Tree highlight
          ctx.fillStyle = '#4cd137';
          ctx.beginPath();
          ctx.arc(rx - 1.5, ry - 1.5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'mountain') {
        ctx.fillStyle = '#7f8fa6';
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        // Draw rocks/mountains
        ctx.fillStyle = '#718093'; // darker shadow side
        ctx.beginPath();
        ctx.moveTo(drawX + 5, drawY + TILE_SIZE - 5);
        ctx.lineTo(drawX + TILE_SIZE/2, drawY + 8);
        ctx.lineTo(drawX + TILE_SIZE - 5, drawY + TILE_SIZE - 5);
        ctx.fill();
        
        ctx.fillStyle = '#dcdde1'; // lighter sun side
        ctx.beginPath();
        ctx.moveTo(drawX + 5, drawY + TILE_SIZE - 5);
        ctx.lineTo(drawX + TILE_SIZE/2, drawY + 8);
        ctx.lineTo(drawX + TILE_SIZE/2 - 5, drawY + TILE_SIZE - 5);
        ctx.fill();
        
        // Snow cap
        ctx.fillStyle = '#f5f6fa';
        ctx.beginPath();
        ctx.moveTo(drawX + TILE_SIZE/2, drawY + 8);
        ctx.lineTo(drawX + TILE_SIZE/2 - 6, drawY + 18);
        ctx.lineTo(drawX + TILE_SIZE/2 + 6, drawY + 18);
        ctx.fill();
      } else if (type === 'water') {
        ctx.fillStyle = '#2980b9'; // ocean blue
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        // Draw waves
        ctx.strokeStyle = '#3498db'; // light wave
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX + 8, drawY + 12);
        ctx.quadraticCurveTo(drawX + 12, drawY + 8, drawX + 16, drawY + 12);
        ctx.moveTo(drawX + 18, drawY + 22);
        ctx.quadraticCurveTo(drawX + 22, drawY + 18, drawX + 26, drawY + 22);
        ctx.stroke();
      }
      
      // Draw grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
    }
  }

  // Draw Entities
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const cx = viewX + dx;
      const cy = viewY + dy;
      const drawX = (dx + RADIUS) * TILE_SIZE;
      const drawY = (dy + RADIUS) * TILE_SIZE;

      if (cx === px && cy === py) {
        drawCastle(ctx, drawX, drawY, '#0984e3', 'YOU'); // Blue player
      } else {
        const op = otherPlayers.find(p => p.town?.location?.x === cx && p.town?.location?.y === cy);
        if (op) {
          const factionColor = getFactionColor(op.faction);
          drawCastle(ctx, drawX, drawY, factionColor, op.discordName?.substring(0,4) || 'Foe');
        }
      }
    }
  }

  // Vignette overlay
  const grad = ctx.createRadialGradient(MAP_SIZE/2, MAP_SIZE/2, MAP_SIZE*0.3, MAP_SIZE/2, MAP_SIZE/2, MAP_SIZE*0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Center crosshair (Targeting)
  const cxC = RADIUS * TILE_SIZE;
  const cyC = RADIUS * TILE_SIZE;
  ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)'; // Gold
  ctx.lineWidth = 2.5;
  const len = 12;
  ctx.beginPath();
  // Top left
  ctx.moveTo(cxC, cyC + len); ctx.lineTo(cxC, cyC); ctx.lineTo(cxC + len, cyC);
  // Top right
  ctx.moveTo(cxC + TILE_SIZE - len, cyC); ctx.lineTo(cxC + TILE_SIZE, cyC); ctx.lineTo(cxC + TILE_SIZE, cyC + len);
  // Bottom right
  ctx.moveTo(cxC + TILE_SIZE, cyC + TILE_SIZE - len); ctx.lineTo(cxC + TILE_SIZE, cyC + TILE_SIZE); ctx.lineTo(cxC + TILE_SIZE - len, cyC + TILE_SIZE);
  // Bottom left
  ctx.moveTo(cxC + len, cyC + TILE_SIZE); ctx.lineTo(cxC, cyC + TILE_SIZE); ctx.lineTo(cxC, cyC + TILE_SIZE - len);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

function getFactionColor(faction: string | undefined): string {
  if (faction === 'Shu') return '#27ae60'; // Green
  if (faction === 'Wei') return '#2980b9'; // Blue
  if (faction === 'Wu') return '#c0392b'; // Red
  return '#7f8c8d'; // Grey
}

function drawCastle(ctx: any, drawX: number, drawY: number, flagColor: string, label: string) {
  const ts = TILE_SIZE;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(drawX + ts/2, drawY + ts - 5, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Castle Base
  ctx.fillStyle = '#ecf0f1'; // Light grey stone
  ctx.fillRect(drawX + 10, drawY + 15, ts - 20, ts - 25);
  
  // Crenellations (Battlements)
  for(let i=0; i<3; i++) {
    ctx.fillRect(drawX + 10 + i * 11, drawY + 10, 8, 5);
  }

  // Gate
  ctx.fillStyle = '#2c3e50'; // dark door
  ctx.beginPath();
  ctx.arc(drawX + ts/2, drawY + ts - 10, 5, Math.PI, 0);
  ctx.lineTo(drawX + ts/2 + 5, drawY + ts - 10);
  ctx.lineTo(drawX + ts/2 - 5, drawY + ts - 10);
  ctx.fill();

  // Flag pole
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(drawX + ts/2, drawY + 10);
  ctx.lineTo(drawX + ts/2, drawY + 0);
  ctx.stroke();

  // Flag
  ctx.fillStyle = flagColor;
  ctx.beginPath();
  ctx.moveTo(drawX + ts/2, drawY + 0);
  ctx.lineTo(drawX + ts/2 + 10, drawY + 4);
  ctx.lineTo(drawX + ts/2, drawY + 8);
  ctx.fill();

  // Label background
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(drawX + 5, drawY + ts - 2, ts - 10, 14);
  
  // Label text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(label, drawX + ts/2, drawY + ts + 1);
}

export async function generateFullMapImage(otherPlayers: any[], currentPlayer: any, disasters: any[] = []): Promise<Buffer> {
  const FULL_SIZE = 800;
  const WORLD_RADIUS = 50; // -50 to +50 is 101 tiles
  const TS = Math.floor(FULL_SIZE / (WORLD_RADIUS * 2 + 1)); // ~7.9 -> 7
  const ACTUAL_SIZE = TS * (WORLD_RADIUS * 2 + 1);
  
  const canvas = createCanvas(ACTUAL_SIZE, ACTUAL_SIZE);
  const ctx = canvas.getContext('2d');
  
  const playerX = currentPlayer?.town?.location?.x || 0;
  const playerY = currentPlayer?.town?.location?.y || 0;
  const FOG_RADIUS = 7; // Vision radius for Fog of War

  const allPlayers = [...otherPlayers];
  if (currentPlayer) allPlayers.push(currentPlayer);

  for (let dy = -WORLD_RADIUS; dy <= WORLD_RADIUS; dy++) {
    for (let dx = -WORLD_RADIUS; dx <= WORLD_RADIUS; dx++) {
      const type = getTileType(dx, dy);
      const drawX = (dx + WORLD_RADIUS) * TS;
      const drawY = (dy + WORLD_RADIUS) * TS;
      
      const distToPlayer = Math.sqrt(Math.pow(dx - playerX, 2) + Math.pow(dy - playerY, 2));
      
      if (distToPlayer > FOG_RADIUS) {
        // Fog of War
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(drawX, drawY, TS, TS);
      } else {
        if (type === 'plains') ctx.fillStyle = '#6ab04c';
        else if (type === 'forest') ctx.fillStyle = '#1e8449';
        else if (type === 'water') ctx.fillStyle = '#2980b9';
        else ctx.fillStyle = '#7f8fa6'; // mountain
        ctx.fillRect(drawX, drawY, TS, TS);

        // Faction Zone of Control (ZOC) - only visible within fog
        let closestFaction = null;
        let minZocDist = 5; // Max ZOC radius is 5
        for (const p of allPlayers) {
           if (p.faction && p.town?.location) {
              const zocDist = Math.sqrt(Math.pow(dx - p.town.location.x, 2) + Math.pow(dy - p.town.location.y, 2));
              if (zocDist < minZocDist) {
                 minZocDist = zocDist;
                 closestFaction = p.faction;
              }
           }
        }
        
        if (closestFaction) {
           ctx.fillStyle = getFactionColor(closestFaction);
           ctx.globalAlpha = 0.3; // 30% opacity overlay
           ctx.fillRect(drawX, drawY, TS, TS);
           ctx.globalAlpha = 1.0; // reset
        }
      }
    }
  }

  // Draw Disasters
  const now = Date.now();
  for (const d of disasters) {
     const elapsedMins = (now - d.startMs) / 60000;
     const curX = d.x + (d.vx * elapsedMins);
     const curY = d.y + (d.vy * elapsedMins);
     
     // Only draw if within Fog of War of the player
     const distToPlayer = Math.sqrt(Math.pow(curX - playerX, 2) + Math.pow(curY - playerY, 2));
     if (distToPlayer - d.radius <= FOG_RADIUS) { // visible if edge touches fog
        const drawX = (curX + WORLD_RADIUS) * TS + TS/2;
        const drawY = (curY + WORLD_RADIUS) * TS + TS/2;
        const radiusPx = d.radius * TS;
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, radiusPx, 0, Math.PI * 2);
        
        if (d.type === 'blizzard') {
           ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
           ctx.strokeStyle = 'rgba(150, 200, 255, 0.8)';
        } else if (d.type === 'plague') {
           ctx.fillStyle = 'rgba(100, 0, 150, 0.4)';
           ctx.strokeStyle = 'rgba(200, 50, 255, 0.8)';
        } else { // drought
           ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
           ctx.strokeStyle = 'rgba(255, 50, 0, 0.8)';
        }
        
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
     }
  }

  // Draw Provincial Capitals
  const { loadWorldDB } = require('./world');
  const worldDB = loadWorldDB();
  for (const cap of Object.values(worldDB.regions) as any) {
     if (cap.id.startsWith('cap')) {
        const cx = cap.x;
        const cy = cap.y;
        const distToCurrent = Math.sqrt(Math.pow(cx - playerX, 2) + Math.pow(cy - playerY, 2));
        if (distToCurrent <= FOG_RADIUS) {
           const drawX = (cx + WORLD_RADIUS) * TS;
           const drawY = (cy + WORLD_RADIUS) * TS;
           ctx.fillStyle = '#bdc3c7'; // silver outline
           ctx.fillRect(drawX - 2, drawY - 2, TS + 4, TS + 4);
           ctx.fillStyle = getFactionColor(cap.controller); // faction color
           ctx.fillRect(drawX, drawY, TS, TS);
           // Draw star icon or text
           ctx.fillStyle = '#fff';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'top';
           ctx.font = 'bold 8px sans-serif';
           ctx.fillText('★', drawX + TS/2, drawY - 8);
        }
     }
  }

  // Draw Players
  for (const p of allPlayers) {
    if (p.town?.location) {
      const px = p.town.location.x;
      const py = p.town.location.y;
      
      // Only draw if within Fog of War
      const distToCurrent = Math.sqrt(Math.pow(px - playerX, 2) + Math.pow(py - playerY, 2));
      if (distToCurrent <= FOG_RADIUS) {
        if (px >= -WORLD_RADIUS && px <= WORLD_RADIUS && py >= -WORLD_RADIUS && py <= WORLD_RADIUS) {
          const drawX = (px + WORLD_RADIUS) * TS;
          const drawY = (py + WORLD_RADIUS) * TS;
          
          if (p === currentPlayer) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(drawX - 2, drawY - 2, TS + 4, TS + 4);
            ctx.fillStyle = '#f1c40f';
          } else {
            ctx.fillStyle = getFactionColor(p.faction);
          }
          ctx.fillRect(drawX - 1, drawY - 1, TS + 2, TS + 2);
        }
      }

      // Draw Marches (Dashed lines)
      if (p.town.marches) {
        for (const m of p.town.marches) {
          if (m.status === 'marching' || m.status === 'returning') {
            const startX = m.status === 'marching' ? px : m.targetX;
            const startY = m.status === 'marching' ? py : m.targetY;
            const endX = m.status === 'marching' ? m.targetX : px;
            const endY = m.status === 'marching' ? m.targetY : py;
            
            // Only draw line if at least one endpoint is in FOG_RADIUS
            const startDist = Math.sqrt(Math.pow(startX - playerX, 2) + Math.pow(startY - playerY, 2));
            const endDist = Math.sqrt(Math.pow(endX - playerX, 2) + Math.pow(endY - playerY, 2));
            
            if (startDist <= FOG_RADIUS || endDist <= FOG_RADIUS) {
               ctx.beginPath();
               ctx.moveTo((startX + WORLD_RADIUS) * TS + TS/2, (startY + WORLD_RADIUS) * TS + TS/2);
               ctx.lineTo((endX + WORLD_RADIUS) * TS + TS/2, (endY + WORLD_RADIUS) * TS + TS/2);
               ctx.setLineDash([5, 5]);
               ctx.strokeStyle = getFactionColor(p.faction);
               ctx.lineWidth = 2;
               ctx.stroke();
               ctx.setLineDash([]); // reset

               // Draw moving dot
               const now = Date.now();
               const totalTime = m.arrivalMs - m.startMs;
               if (totalTime > 0) {
                 const progress = Math.min(1, Math.max(0, (now - m.startMs) / totalTime));
                 const curX = startX + (endX - startX) * progress;
                 const curY = startY + (endY - startY) * progress;
                 
                 ctx.fillStyle = getFactionColor(p.faction);
                 ctx.beginPath();
                 ctx.arc((curX + WORLD_RADIUS) * TS + TS/2, (curY + WORLD_RADIUS) * TS + TS/2, 3, 0, Math.PI*2);
                 ctx.fill();
               }
            }
          }
        }
      }
    }
  }

  // Add a nice semi-transparent black border
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, ACTUAL_SIZE, ACTUAL_SIZE);

  return canvas.toBuffer('image/png');
}
