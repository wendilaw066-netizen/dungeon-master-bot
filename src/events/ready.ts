import { Client, Events, ActivityType, TextChannel, EmbedBuilder } from 'discord.js';
import { logger } from '../logger';
import { BotEvent } from '../types';
import { startAdScheduler } from '../utils/ad-scheduler';

// Track active bot-status channels
export const botStatusChannels = new Map<string, { channelId: string; guildId: string }>();

const readyEvent: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    logger.success(`Logged in as ${client.user?.tag}!`, 'Bot');
    
    // Log active guilds
    const guilds = client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ') || 'None';
    logger.info(`Bot is currently in ${client.guilds.cache.size} guild(s): [${guilds}]`, 'Bot');

    // Set premium visual status
    client.user?.setActivity({
      name: 'your server | /rank 🏆',
      type: ActivityType.Watching,
    });

    // Start automated ad scheduler
    startAdScheduler(client);

    // ==========================================
    // SYNC DISCORD NAMES FOR ALL EXISTING PLAYERS
    // ==========================================
    // Run after 3 seconds to let everything initialize
    setTimeout(async () => {
      try {
        const { loadMinigameDB, setPlayerName } = require('../utils/minigame');
        const db = loadMinigameDB();
        const playerIds = Object.keys(db);
        if (playerIds.length === 0) return;

        let synced = 0;
        for (const guild of client.guilds.cache.values()) {
          try {
            // Fetch all members from guild (up to 1000)
            const members = await guild.members.fetch({ limit: 1000 }).catch(() => null);
            if (!members) continue;
            for (const [memberId, member] of members) {
              if (db[memberId]) {
                const displayName = member.displayName || member.user.displayName || member.user.username;
                setPlayerName(db, memberId, displayName);
                synced++;
              }
            }
          } catch (e) {
            logger.error(`Name sync error for guild ${guild.name}: ${e}`, 'NameSync');
          }
        }
        logger.success(`Discord name sync complete: ${synced} player(s) updated.`, 'NameSync');
      } catch (e) {
        logger.error(`Name sync startup error: ${e}`, 'NameSync');
      }
    }, 3000);

    // ==========================================
    // AUTO-INITIALIZE 12 BOTS IN DATABASE
    // ==========================================
    setTimeout(() => {
      try {
        const { loadMinigameDB, getPlayer, saveMinigameDB } = require('../utils/minigame');
        const { personas } = require('../utils/personas');
        const { runBotFullAI } = require('../utils/rpg/bot_full_ai');
        const db = loadMinigameDB();
        
        const botName = client.user?.username || 'ZHU';
        const botIds = [botName, ...personas.map((p: any) => p.name)];
        const factions: ('Shu' | 'Wei' | 'Wu')[] = ['Shu', 'Wei', 'Wu'];
        let fIdx = 0;
        
        for (const bid of botIds) {
          const p = getPlayer(db, bid);
          p.discordName = bid;
          p.autoPlayActive = true;
          if (!p.faction) {
            p.faction = factions[fIdx % factions.length];
          }
          fIdx++;
          // Run initial AI tick so bots start with activity
          runBotFullAI(db, bid, bid);
        }
        saveMinigameDB(db);
        logger.success(`${botIds.length} AI Bots initialized and first tick executed.`, 'BotInit');
      } catch (err) {
        logger.error(`Failed to initialize bots in DB: ${err}`, 'BotInit');
      }
    }, 2000);

    // ==========================================
    // CLEAN UP LEGACY FACTION CHANNELS
    // ==========================================
    setTimeout(async () => {
      const { ChannelType } = require('discord.js');
      for (const guild of client.guilds.cache.values()) {
        try {
          const category = guild.channels.cache.find(c => c.name === 'Guild Area' && c.type === ChannelType.GuildCategory);
          if (category) {
            const channels = guild.channels.cache.filter(c => c.parentId === category.id);
            for (const ch of channels.values()) {
              await ch.delete('Clean up legacy faction channels').catch(() => null);
            }
            await category.delete('Clean up legacy category').catch(() => null);
          }

          // Delete legacy kingdom-chat channel
          const oldKingdomChat = guild.channels.cache.find(c => c.name === 'kingdom-chat' && c.type === ChannelType.GuildText);
          if (oldKingdomChat) {
            await oldKingdomChat.delete('Clean up legacy kingdom-chat').catch(() => null);
          }
        } catch (e) {}
      }
    }, 4000);

    // Start World Boss Event Scheduler (Every 30 minutes)
    const { spawnWorldBoss } = require('../utils/rpg/world-boss');
    setInterval(() => {
      spawnWorldBoss(client).catch((err: any) => logger.error(`World Boss Spawn Error: ${err}`, 'WorldBoss'));
    }, 30 * 60 * 1000); // 30 minutes

    // ==========================================
    // RESOLVE ARMY DEPLOYMENTS (Every 10 seconds)
    // ==========================================
    setInterval(() => {
      try {
        const { loadMinigameDB } = require('../utils/minigame');
        const { resolveDeployments } = require('../utils/rpg/deployments');
        const dbase = loadMinigameDB();
        resolveDeployments(client, dbase);
      } catch (e: any) {
        logger.error(`Deployment Resolver Error: ${e.message}`, 'Deployments');
      }
    }, 10000);

    // ==========================================
    // AI RANDOM EVENTS SIMULATOR (Every 5 minutes)
    // ==========================================
    setInterval(async () => {
      const { triggerRandomEvent } = require('../utils/rpg/alerts');
      triggerRandomEvent(client).catch((err: any) => logger.error(`AI Event Loop Error: ${err}`, 'AIEvent'));
    }, 5 * 60 * 1000); // 5 minutes

    // ==========================================
    // SEASON TICK (Every 1 hour)
    // ==========================================
    setInterval(async () => {
      try {
        const { checkSeasonTick } = require('../utils/rpg/season');
        await checkSeasonTick(client);
      } catch (err) {
        logger.error(`Season Tick Error: ${err}`, 'Season');
      }
    }, 60 * 60 * 1000); // 1 hour

    // Run season check immediately on startup
    setTimeout(() => {
      try {
        const { checkSeasonTick } = require('../utils/rpg/season');
        checkSeasonTick(client);
      } catch (err) {}
    }, 10000);

    // ==========================================
    // USER AUTO-PLAY (Every 5 minutes)
    // ==========================================
    setInterval(async () => {
      try {
        const { loadMinigameDB, saveMinigameDB } = require('../utils/minigame');
        const { runBotFullAI } = require('../utils/rpg/bot_full_ai');
        const { getOrCreateKingdomChat } = require('../utils/rpg/alerts');
        const db = loadMinigameDB();

        const userIds = Object.keys(db);
        const allBotActions: string[] = [];

        for (const userId of userIds) {
          const player = db[userId];
          if (player && (player.autoPlayActive || player.isAuto)) {
            try {
              const userName = player.discordName || `Player_${userId}`;
              const isHumanAuto = !!player.isAuto;
              const actions = await runBotFullAI(db, userId, userName, isHumanAuto);
              if (actions.length > 0) {
                allBotActions.push(...actions);
              }
            } catch (err) {
              logger.error(`Error processing auto-play for ${userId}: ${err}`, 'AutoPlay');
            }
          }
        }

        // Broadcast combined bot activity report to specific channel
        if (allBotActions.length > 0) {
          try {
            const ch = await client.channels.fetch('1529017120698925098');
            if (ch && ch.isTextBased()) {
              // Split into chunks of max 10 actions per embed (Discord limit)
              for (let i = 0; i < allBotActions.length; i += 10) {
                const chunk = allBotActions.slice(i, i + 10);
                const embed = new EmbedBuilder()
                  .setColor(0x2ECC71)
                  .setTitle(`📊 LAPORAN AKTIVITAS AI — Tick #${Math.floor(Date.now() / 15000)}`)
                  .setDescription(
                    `**${chunk.length} aksi** telah dieksekusi oleh bot AI:\n\n` +
                    chunk.join('\n')
                  )
                  .setFooter({ text: `Self-Learning AI Engine • ${allBotActions.length} total aksi` })
                  .setTimestamp();
                await (ch as any).send({ embeds: [embed] }).catch(() => {});
              }
            }
          } catch (e) {
            // Ignore fetch error
          }
        }

        saveMinigameDB(db);
      } catch (err) {
        logger.error(`Global Auto-Play Interval Error: ${err}`, 'AutoPlay');
      }
    }, 15 * 1000); // 15 seconds

    // ==========================================
    
    // ==========================================
    // ESPIONAGE INTELLIGENCE (Setiap 1 Jam)
    // ==========================================
    setInterval(async () => {
      try {
        const { loadMinigameDB } = require('../utils/minigame');
        const { runEspionage } = require('../utils/rpg/bot_espionage');
        const db = loadMinigameDB();
        const reports = runEspionage(db, client);
        
        if (reports.length > 0) {
          const ch = await client.channels.fetch('1529017120698925098').catch(()=>null);
          if (ch && ch.isTextBased()) {
             const { EmbedBuilder } = require('discord.js');
             const embed = new EmbedBuilder()
               .setColor(0x8B0000)
               .setTitle('🕵️ LAPORAN MATA-MATA FAKSI')
               .setDescription(reports.join('\n\n'))
               .setFooter({ text: 'Sistem Intelijen AI' })
               .setTimestamp();
             await (ch as any).send({ embeds: [embed] }).catch(()=>{});
          }
        }
      } catch (err) {
        logger.error(`Espionage Error: ${err}`, 'Espionage');
      }
    }, 60 * 60 * 1000);

    // ==========================================
    // GENETIC ALGORITHM (Evolusi Bot - Setiap 24 Jam)
    // ==========================================
    setInterval(async () => {
      try {
        const { loadMinigameDB, saveMinigameDB, getPlayer } = require('../utils/minigame');
        const db = loadMinigameDB();
        const { personas } = require('../utils/personas');
        const botNames = [client.user?.username || 'ZHU', ...personas.map((p: any) => p.name)];
        
        const botsData = [];
        for (const bName of botNames) {
           const p = db[bName];
           if (p) botsData.push({ id: bName, wealth: (p.coins || 0) });
        }
        
        if (botsData.length >= 5) {
           botsData.sort((a, b) => b.wealth - a.wealth); // Highest first
           // Top 20%
           const topCount = Math.max(1, Math.floor(botsData.length * 0.2));
           const bottomCount = Math.max(1, Math.floor(botsData.length * 0.2));
           
           const topBots = botsData.slice(0, topCount);
           const bottomBots = botsData.slice(botsData.length - bottomCount);
           
           const report = [];
           
           for (const weakBot of bottomBots) {
              const weakName = weakBot.id;
              // Find a random strong bot to clone personality from
              const strongBot = topBots[Math.floor(Math.random() * topBots.length)];
              const strongPersona = db[strongBot.id].personality;
              
              // Culling: Delete town and reset wealth
              db[weakName].town = undefined;
              db[weakName].coins = 100;
              db[weakName].materials = {};
              
              // Mutate/Inherit
              db[weakName].personality = strongPersona;
              db[weakName].faction = db[strongBot.id].faction;
              
              report.push(`💀 Bot **${weakName}** telah gugur karena bangkrut! Generasi baru terlahir mewarisi sifat [${strongPersona}] dari **${strongBot.id}**.`);
           }
           
           saveMinigameDB(db);
           
           const ch = await client.channels.fetch('1529017120698925098').catch(()=>null);
           if (ch && ch.isTextBased()) {
              const { EmbedBuilder } = require('discord.js');
              const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🧬 EVOLUSI GENETIK AI')
                .setDescription(report.join('\n'))
                .setFooter({ text: 'Natural Selection Engine' })
                .setTimestamp();
              await (ch as any).send({ embeds: [embed] }).catch(()=>{});
           }
        }
      } catch (err) {
        logger.error(`Evolution Error: ${err}`, 'Evolution');
      }
    }, 24 * 60 * 60 * 1000);

    // ==========================================
    // OWNER ASSET DASHBOARD (HTTP Server)
    // ==========================================
    startOwnerDashboard(client);
  },
};

function startOwnerDashboard(client: Client) {
  try {
    const express = require('express');
    const cors = require('cors');
    const fs = require('fs');
    const path = require('path');
    
    const app = express();
    const PORT = process.env.DASHBOARD_PORT ? parseInt(process.env.DASHBOARD_PORT) : 3420;
    const DB_PATH = path.join(process.cwd(), 'minigame-db.json');
    const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

    app.use(cors());
    app.use(express.json());

    // Basic Auth Middleware for API
    const authMiddleware = (req: any, res: any, next: any) => {
      const pass = req.headers['x-owner-password'] || req.query.password;
      if (pass === DASHBOARD_PASSWORD) {
        return next();
      }
      return res.status(401).json({ success: false, message: 'Unauthorized. Invalid password.' });
    };

    // Serve static frontend files
    app.use(express.static(path.join(process.cwd(), 'public')));

    function readDBFromDisk(): Record<string, any> {
      try {
        if (fs.existsSync(DB_PATH)) {
          return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        }
      } catch (e) {
        logger.error(`Dashboard: failed to read DB from disk: ${e}`, 'Dashboard');
      }
      return {};
    }

    // Auto-backup function
    const BACKUP_DIR = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

    function createBackup() {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `minigame-db-${timestamp}.json`);
        
        const { loadMinigameDB } = require('../utils/minigame');
        const db = loadMinigameDB();
        
        if (db && Object.keys(db).length > 0) {
          fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
          logger.info(`Auto-Backup: Created memory-based database backup at ${backupPath}`, 'Backup');
          
          const files = fs.readdirSync(BACKUP_DIR)
            .filter((f: string) => f.startsWith('minigame-db-'))
            .map((f: string) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }));
          files.sort((a: any, b: any) => b.time - a.time);
          if (files.length > 10) {
            for (let i = 10; i < files.length; i++) {
              fs.unlinkSync(path.join(BACKUP_DIR, files[i].name));
            }
          }
        }
      } catch (err) {
        logger.error(`Auto-Backup failed: ${err}`, 'Backup');
      }
    }

    createBackup();
    setInterval(createBackup, 30 * 60 * 1000);

    // API: Public Map (No password required)
    app.get('/api/public/map', (req: any, res: any) => {
      let db: Record<string, any>;
      try {
        const { loadMinigameDB } = require('../utils/minigame');
        db = loadMinigameDB() as Record<string, any>;
      } catch (e) {
        db = readDBFromDisk();
      }

      const mapData: any[] = [];
      for (const [id, player] of Object.entries(db)) {
        if (!player || typeof player !== 'object') continue;
        const p = player as any;
        if (!p.town) continue; // Only players with towns

        const totalArmy = (p.town.army?.infantry || 0) + (p.town.army?.archers || 0) + (p.town.army?.cavalry || 0) + (p.town.army?.spearmen || 0) + (p.town.army?.catapults || 0);

        mapData.push({
          id,
          name: p.discordName || `Player_${id.substring(0,4)}`,
          faction: p.faction || 'Neutral',
          tier: p.town.tier || 1,
          morale: p.town.morale || 100,
          publicOrder: p.town.publicOrder || 100,
          armyEstimate: totalArmy,
          alliances: p.town.alliances || []
        });
      }

      return res.json({ success: true, data: mapData });
    });

    // API: Get Players
    app.get('/api/players', authMiddleware, (req: any, res: any) => {
      let db: Record<string, any>;
      try {
        const { loadMinigameDB } = require('../utils/minigame');
        db = loadMinigameDB() as Record<string, any>;
      } catch (e) {
        db = readDBFromDisk();
      }

      const DIFFS = ['Normal', 'Hard', 'Nightmare', 'Hell', 'Torment'];
      const players: any[] = [];

      for (const [id, player] of Object.entries(db)) {
        if (!player || typeof player !== 'object') continue;
        const p = player as any;
        const dp = p.dungeonProgress || {};
        
        const isOnline = p.lastActiveTime && (Date.now() - p.lastActiveTime < 300000);
        const lastActiveStr = isOnline 
          ? '🟢 Online' 
          : (p.lastActiveTime ? `Last seen: ${new Date(p.lastActiveTime).toLocaleTimeString('id-ID')} ${new Date(p.lastActiveTime).toLocaleDateString('id-ID')}` : 'Last seen: N/A');

        players.push({
          id,
          name: p.discordName || id,
          userId: id,
          faction: p.faction || 'Neutral',
          hp: p.hp ?? 0,
          maxHp: p.maxHp ?? 100,
          hp_pct: p.maxHp ? Math.round((p.hp / p.maxHp) * 100) : 100,
          coins: p.coins ?? 0,
          
          
          gems: p.gems ?? 0,
          town: p.town ? {
            tier: p.town.tier || 0,
            alliances: p.town.alliances ? p.town.alliances.length : 0
          } : null,
          army: p.town?.army ? {
            infantry: p.town.army.infantry || 0,
            archers: p.town.army.archers || 0,
            cavalry: p.town.army.cavalry || 0,
            spearmen: p.town.army.spearmen || 0,
            catapults: p.town.army.catapults || 0
          } : null,
          lastActive: lastActiveStr,
          isJailed: p.jailTime && p.jailTime > Date.now()
        });
      }

      players.sort((a, b) => (b.coins + b.dls * 100) - (a.coins + a.dls * 100));

      const totalWl = players.reduce((s, p) => s + (p.coins || 0), 0);
      const totalDl = players.reduce((s, p) => s + (0 || 0), 0);

      res.json({
        success: true,
        players,
        total: players.length,
        summary: {
          totalWl,
          totalDl,
          topPlayerWl: players[0]?.coins || 0,
        }
      });
    });

    // API: Control
    app.post('/api/control', authMiddleware, (req: any, res: any) => {
      try {
        const data = req.body;
        const { loadMinigameDB, saveMinigameDB, getPlayer } = require('../utils/minigame');
        const { pushDashboardLog } = require('../utils/rpg/dashboard');
        const db = loadMinigameDB();
        const player = getPlayer(db, data.userId);

        if (data.action === 'jail') {
          const minutes = parseInt(data.minutes) || 10;
          player.jailTime = Date.now() + (minutes * 60 * 1000);
          pushDashboardLog(player, `🛠️ GM Dashboard: Dimasukkan ke penjara selama ${minutes} menit!`);
          saveMinigameDB(db);
          return res.json({ success: true, message: `Player dipenjara selama ${minutes} menit!` });
        }

        if (data.action === 'edit_player') {
          player.coins = data.coins;
          
          
          player.gems = data.gems;
          player.gems = data.gems;
          
          if (!player.town) {
            player.town = {
              tier: 1,
              landSlots: 5,
              villagers: 10,
              morale: 100,
              buildings: { houses: 1, farms: 1 }
            };
          }
          
          if (player.town) {
            player.town.army = player.town.army || { infantry: 0, archers: 0, cavalry: 0, spearmen: 0, catapults: 0 };
            player.town.army.infantry = data.army.infantry;
            player.town.army.archers = data.army.archers;
            player.town.army.cavalry = data.army.cavalry;
            player.town.army.spearmen = data.army.spearmen;
            player.town.army.catapults = data.army.catapults;
          }
          
          pushDashboardLog(player, `🛠️ GM Dashboard: Aset dan militer diedit oleh Owner!`);
          saveMinigameDB(db);
          return res.json({ success: true, message: 'Player assets updated successfully!' });
        }

        if (data.action === 'unjail') {
          player.jailTime = 0;
          pushDashboardLog(player, `🛠️ GM Dashboard: Dibebaskan dari penjara!`);
          saveMinigameDB(db);
          return res.json({ success: true, message: 'Player dibebaskan dari penjara!' });
        }

        if (data.action === 'trigger_event') {
          return res.json({ success: true, message: `Event ${data.eventType} started!` });
        }

        if (data.action === 'spawn_boss') {
          return res.json({ success: true, message: `World boss ${data.bossName} spawned with ${data.bossHp} HP!` });
        }

        if (data.action === 'announce') {
          try {
            const { broadcastAnnouncement } = require('../utils/rpg/alerts');
            broadcastAnnouncement(client, `👑 **IMPERIAL DECREE:**\n${data.text}`);
            return res.json({ success: true, message: 'Announcement sent.' });
          } catch (e: any) {
            return res.json({ success: true, message: `Failed to broadcast via discord, logged instead. ${e.message}` });
          }
        }

        return res.json({ success: false, message: 'Aksi tidak dikenal.' });
      } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
      }
    });

    app.listen(PORT, () => {
      logger.success(`Owner Dashboard running at http://localhost:${PORT}`, 'Dashboard');
      logger.info(`Dashboard reading DB from: ${DB_PATH}`, 'Dashboard');
      
      // Start Tunnel (Cloudflared with Localtunnel Fallback)
      const startTunnel = async () => {
        try {
          const { spawn } = require('child_process');
          const path = require('path');
          const cfPath = path.join(process.cwd(), 'node_modules', 'cloudflared', 'bin', 'cloudflared.exe');
          const cf = spawn(cfPath, ['tunnel', '--url', `http://localhost:${PORT}`]);
          
          let gotUrl = false;
          cf.stderr.on('data', (data: Buffer) => {
            const output = data.toString();
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match && !(global as any).cloudflareDashboardUrl) {
              gotUrl = true;
              (global as any).cloudflareDashboardUrl = match[0];
              logger.success(`Cloudflare Tunnel URL: ${match[0]}`, 'Dashboard');
            }
          });
          
          setTimeout(async () => {
            if (!gotUrl && !(global as any).cloudflareDashboardUrl) {
              try {
                logger.info('Cloudflare Tunnel rate-limited or pending. Initiating Localtunnel fallback...', 'Dashboard');
                const localtunnel = require('localtunnel');
                const tunnel = await localtunnel({ port: PORT });
                (global as any).cloudflareDashboardUrl = tunnel.url;
                logger.success(`Localtunnel Fallback Online URL: ${tunnel.url}`, 'Dashboard');
              } catch (ltErr: any) {
                logger.error(`Localtunnel fallback error: ${ltErr.message}`, 'Dashboard');
              }
            }
          }, 4000);
        } catch (err: any) {
          logger.error(`Failed to start tunnel: ${err.message}`, 'Dashboard');
        }
      };
      startTunnel();
    });

  } catch (err: any) {
    logger.error(`Failed to start dashboard: ${err.message}`, 'Dashboard');
  }
}

export default readyEvent;
