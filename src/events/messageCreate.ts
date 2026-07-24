
import { handleGuildCommand } from '../utils/rpg/guilds';
import { handleArena, handleArenaTop, handleArenaAccept } from '../utils/rpg/arena';
import { Message, Events, EmbedBuilder } from 'discord.js';
import { logger } from '../logger';
import { db } from '../database';
import { getXpForLevel } from '../commands/leveling';
import { BotEvent } from '../types';
import { logModAction } from '../utils/mod-logger';
import { handleAiMention, parseAndSaveTradeList, clearConversationHistory, analyzeImage } from '../utils/ai';
import { extractFactFromMessage, clearMemory } from '../utils/memory';
import { isSimulationRunning, forceSimulationTick } from '../utils/simulation';
import { farm, buy, checkInventory, heal, rob, gacha } from '../utils/minigame';
import { handleDungeonCampaign } from '../utils/rpg/dungeon_v2';
import { handleEquip, handleUnequip, handleRepair, handleForge } from '../utils/rpg/equipment';
import { renderDashboard } from '../utils/rpg/dashboard';
import { handleJobCommand } from '../utils/rpg/jobs';
import { handleBorrow, handleRepay } from '../utils/rpg/bank';
import { handleTradeInit, handleTradeOffer, handleTradeConfirm, handleTradeCancel, handleTradeStatus } from '../utils/rpg/trade';
import { handleTavernMenu, handleTavernRest, handleTavernDrink, handleTavernBoard } from '../utils/rpg/tavern';
import { handleShopMenu, handleShopCategory, buildShopBuyEmbed } from '../utils/rpg/shop';
import { handleWeaponShopPage, handleWeaponShopBuy, findShopWeapon } from '../utils/rpg/weapons';
import { loadMinigameDB, getPlayer, saveMinigameDB, setPlayerName } from '../utils/minigame';
import { loadWorldDB, saveWorldDB, simulateFactionTick } from '../utils/rpg/world';
import { handleSwarmCatch, handleZoo } from '../utils/rpg/swarm';
import { tempa } from '../utils/rpg/blacksmith';
import { buildItemLookupEmbed, buildGtInvEmbed, sellGtItem } from '../utils/rpg/items';
import { announceGachaPull, getOrCreateAnnounceChannel } from '../utils/announcer';
const COOLDOWN_MS = 60000; // 60-second cooldown to prevent spamming XP
const SPAM_THRESHOLD_MS = 3000; // 3 seconds
const SPAM_MAX_MESSAGES = 5;

// Memory cache to track member message rates: key is 'guildId-userId', value is array of timestamps
const messageRates = new Map<string, number[]>();

const messageCreateEvent: BotEvent = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (!message.guildId) return;

    const channelName = (message.channel as any).name?.toLowerCase() || '';
    const isKnowledgeChannel = ['growtopia-information', 'daily-quest', 'catch-of-the-day'].includes(channelName);
    const isBot = message.author.bot;

    // ==========================================
    // 0. OFFICIAL KNOWLEDGE EXTRACTION
    // ==========================================
    
    // ==========================================
    // 0.2 LLM GENERATIVE CORE (Next-Gen AI Chatbot)
    // ==========================================
    // If message mentions the bot itself or one of the personas textually
    if (!message.author.bot) {
      try {
        const { personas } = require('../utils/personas');
        const { getPlayer, loadMinigameDB } = require('../utils/minigame');
        const { generateBotResponse } = require('../utils/llm_core');
        
        let targetBotName = null;
        if (message.mentions.users.size > 0 && message.mentions.has(message.client.user?.id || '')) {
           targetBotName = message.client.user?.username;
        }
        
        // Sometimes users mention by text e.g., @Arga or just Arga
        if (!targetBotName) {
           const text = message.content.toLowerCase();
           // Require the word to be prefixed with @, e.g. @arga
           const matched = personas.find((p: any) => text.includes(`@${p.name.toLowerCase()}`));
           if (matched) targetBotName = matched.name;
        }

        if (targetBotName) {
           const persona = personas.find((p: any) => p.name === targetBotName) || personas[0];
           const db = loadMinigameDB();
           const botState = getPlayer(db, targetBotName);
           
           if ('sendTyping' in message.channel) (message.channel as any).sendTyping();
           
           (async () => {
             try {
               const reply = await generateBotResponse(targetBotName, persona.systemPrompt, message.content, botState);
               
               let webhookSent = false;
               if (!message.channel.isDMBased() && 'fetchWebhooks' in message.channel) {
                 try {
                   const webhooks = await (message.channel as any).fetchWebhooks();
                   let webhook = webhooks.find((wh: any) => wh.token);
                   if (!webhook) {
                     webhook = await (message.channel as any).createWebhook({
                       name: 'Three Kingdoms RPG',
                       avatar: message.client.user?.displayAvatarURL()
                     });
                   }
                   if (webhook) {
                     await webhook.send({
                       content: `<@${message.author.id}> ${reply}`,
                       username: targetBotName,
                       avatarURL: persona.avatarUrl
                     });
                     webhookSent = true;
                   }
                 } catch (whErr) {
                   // Webhook permissions might be missing, fallback to normal reply
                 }
               }
               
               if (!webhookSent) {
                 message.reply(`**[${targetBotName}]** 💬\n${reply}`);
               }
             } catch (err) {}
           })();
           
           return; // Stop further processing to avoid command clashes
        }
      } catch (err) {
         logger.error(`Chatbot error: ${err}`, 'LLMCore');
      }
    }

    if (isKnowledgeChannel && message.content.length >= 10) {
      extractFactFromMessage(message.author.username, message.content, true).catch(err => {
        logger.error(`Error in background official memory extraction: ${err}`, 'Memory');
      });
      if (isBot) return; // Bots stop processing here
    }

    // ==========================================
    // 0.5 MINIGAME COMMANDS (Bots can play too!)
    // ==========================================
    const minigameArgs = message.content.trim().split(/\s+/);
    const minigameCmd = minigameArgs[0].toLowerCase();
    
    // Auto-save Discord username on every game command
    const _minigameCmds = ['!menu','!farm','!buy','!inv','!equip','!dungeon','!heal','!boss','!job','!kota','!bank','!trade','!gacha','!arena'];
    if (!message.author.bot && _minigameCmds.some(c => minigameCmd.startsWith(c))) {
      try {
        const _db2 = loadMinigameDB();
        if (_db2[message.author.id]) {
          const _dname = message.member?.displayName || message.author.displayName || message.author.username;
          setPlayerName(_db2, message.author.id, _dname);
        }
      } catch (_e) { /* ignore */ }
    }
    // Get owner ID for tax system
    const ownerId = message.guild?.ownerId || null;
    const playerIdentifier = isBot ? message.author.username : message.author.id;
    
    // Quick load DB for V2 commands
    const doV2Command = (cmdFn: any) => {
       const db = loadMinigameDB();
       const player = getPlayer(db, playerIdentifier);
       const response = cmdFn(db, player);
       // Support both plain string and embed object responses
       if (typeof response === 'string') {
         message.reply(response).catch(()=>{});
       } else {
         message.reply(response as any).catch(()=>{});
       }
    };

    if (minigameCmd === '!botbuild' || minigameCmd === '!townbot') {
      const { runBotTownAI } = require('../utils/rpg/town_bot_ai');
      const db = loadMinigameDB();
      const botName = message.client.user?.username || 'ZHU Bot';
      const botId = message.client.user?.id || 'bot_zhu';
      
      const result = runBotTownAI(db, botId, botName);
      if (result) {
        message.reply(result).catch(() => {});
      } else {
        message.reply(`🏰 Kota **${botName}** sedang dalam kondisi prima dan terus mengumpulkan pajak pasif!`).catch(() => {});
      }
      return;
    }

    if (minigameCmd === '!command' || minigameCmd === '!help' || minigameCmd === '!cmd') {
      const e = new EmbedBuilder()
        .setColor(0x2C3E50)
        .setTitle('Town Simulation Command List')
        .setDescription('All command shortcuts are listed below. Use **`!menu`** for the interactive one-click Town Dashboard!')
        .addFields(
          {
            name: '🏰 CORE COMMANDS',
            value: [
              '`!start` - Reset your account and get the Starter Pack (20 Coin)',
              '`!menu` - 🌟 Open the interactive Town Dashboard (Town, Treasury, Auction, Factions)',
              '`!setupfactions` - (Admin only) Setup the interactive faction selection roles channel',
            ].join('\n'),
            inline: false
          },
          {
            name: '⚖️ TRADE & AUCTION',
            value: [
              '`!auction view` - Check all active market listings',
              '`!auction sell <wl_price> <item_name>` - Sell resources or weapons to the market',
              '`!auction buy <id>` - Purchase listed item from the market',
              '`!auction cancel <id>` - Cancel your active listing',
              '`!trade @user` - Initiate a direct barter trade with another player',
            ].join('\n'),
            inline: false
          },
          {
            name: '🗺️ MAP & KNOWLEDGE',
            value: [
              '`!map` - View world commanders and travel to other regions',
              '`!item <name>` - Look up any item info from the official database',
            ].join('\n'),
            inline: false
          }
        )
        .setFooter({ text: 'Tip: Use !menu to handle housing upgrades, food production, military recruits, and resource management!' });
      message.reply({ embeds: [e] }).catch(()=>{});
      return;
    }


    if (minigameCmd === '!redeem') {
      const code = minigameArgs[1]?.toUpperCase();
      if (!code) {
        message.reply('❌ Masukkan kode! Contoh: `!redeem BLOODMOON2026`');
        return;
      }
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      
      if (code === 'BLOODMOON2026') {
        if (p.items.includes('CLAIMED_BLOODMOON')) {
          message.reply('❌ Kamu sudah klaim kode ini!');
          return;
        }
        p.items.push('CLAIMED_BLOODMOON');
        p.coins += 100;
        p.eventBloodstones = (p.eventBloodstones || 0) + 5;
        const fs = require('fs');
        fs.writeFileSync(require('path').join(process.cwd(), 'minigame-db.json'), JSON.stringify(db, null, 2), 'utf-8');
        message.reply('🎁 **KODE BERHASIL DITUKAR!** Kamu mendapatkan **100 Coin** dan **5 Bloodstones**!');
        return;
      }
      message.reply('❌ Kode tidak valid atau sudah kadaluarsa.');
      return;
    }

    if (minigameCmd === '!start') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      p.coins = 0; // Starts from absolute 0
      p.tutorialStep = 5;
      saveMinigameDB(db);
      message.reply('🎉 **Akun berhasil dibuat!** Kamu memulai permainan dengan **0 Coin**. Kumpulkan modal dengan sabar! Ketik **`!menu`** untuk mengelola kotamu!').catch(()=>{});
      return;
    }

    if (minigameCmd === '!setupfactions') {
      if (!message.member?.permissions.has('Administrator')) {
        message.reply('❌ Only administrators can setup faction channels.').catch(()=>{});
        return;
      }
      const { renderFactionSelection } = require('../utils/rpg/factions');
      const resp = renderFactionSelection(message.author.username);
      if (message.channel.isTextBased() && 'send' in message.channel) {
        (message.channel as any).send(resp).catch(()=>{});
      }
      return;
    }

    if (minigameCmd === '!hardreset') {
      if (!message.member?.permissions.has('Administrator') && message.author.id !== 'YOUR_OWNER_ID') { // Just basic admin check
        if (!message.member?.permissions.has('Administrator')) {
          message.reply('❌ Only administrators can hard reset the database.').catch(()=>{});
          return;
        }
      }
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'minigame-db.json');
      fs.writeFileSync(dbPath, '{}', 'utf-8');
      
      // We also need to clear the memory cache if possible, but loadMinigameDB caches it? 
      // Actually, loadMinigameDB reads from disk on every require, but it's not a require, it's fs.readFileSync usually.
      // Let's just write {} and tell the user to restart if we can't clear the cache, BUT wait, our saveMinigameDB writes the memory.
      // If we exit the process, PM2 or discord bot manager will restart it automatically!
      message.reply('⚠️ **HARD RESET INITIATED!** Database wiped. The bot will now restart to clear memory.').then(() => {
         process.exit(1);
      }).catch(() => {
         process.exit(1);
      });
      return;
    }

    const blockedCmds = ['!shop', '!trade', '!job', '!pinjam', '!bayar', '!tempa', '!upgrade', '!tavern', '!buy', '!rob'];
    if (blockedCmds.includes(minigameCmd)) {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      if ((p.tutorialStep || 0) < 5) {
        message.reply('🛑 **Akses Ditolak!** Kamu harus menyelesaikan Quest Tutorial terlebih dahulu. Ketik `!start` untuk mengambil Starter Pack-mu!').catch(()=>{});
        return;
      }
    }

    // ──────────────────────────────────────────────
    // ⚔️ WORLD BOSS COMMANDS
    // ──────────────────────────────────────────────

    if (minigameCmd === '!boss') {
      const sub = minigameArgs[1]?.toLowerCase();
      if (sub === 'attack' || sub === 'serang') {
        const { handleBossAttack } = require('../utils/rpg/world-boss');
        const embed = await handleBossAttack(playerIdentifier, message.author.username, message.client, message.guild);
        message.reply({ embeds: [embed] }).catch(() => {});
        return;
      } else {
        message.reply('⚔️ Ketik `!boss attack` untuk menyerang World Boss yang sedang aktif!').catch(() => {});
        return;
      }
    }

    // ──────────────────────────────────────────────
    // 🎮 GT ITEM DATABASE COMMANDS
    // ──────────────────────────────────────────────

    if (minigameCmd === '!item') {
      const query = minigameArgs.slice(1).join(' ');
      if (!query) {
        message.reply('❌ Masukkan nama item! Contoh: `!item angel wings`').catch(() => {});
        return;
      }
      const embed = buildItemLookupEmbed(query);
      message.reply({ embeds: [embed] }).catch(() => {});
      return;
    }

    if (minigameCmd === '!jual' || (minigameCmd === '!shop' && (minigameArgs[1] === 'sell' || minigameArgs[1] === 'jual'))) {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const query = minigameCmd === '!jual' ? minigameArgs.slice(1).join(' ') : minigameArgs.slice(2).join(' ');
      
      if (!query) {
        const { EmbedBuilder } = require('discord.js');
        const e = new EmbedBuilder().setColor(0x3498DB).setTitle('📦 Barang yang Bisa Dijual');
        let text = 'Gunakan `!jual <nama barang>` atau `!shop sell <nama>`\n\n';
        
        let hasItem = false;
        if (p.items && p.items.length > 0) {
          text += '**🗡️ Equipment & Senjata:**\n' + p.items.map((i: any) => `- ${i}`).join('\n') + '\n\n';
          hasItem = true;
        }
        if (p.gtItems && p.gtItems.length > 0) {
          text += '**💎 GT Items:**\n' + p.gtItems.map((i: any) => `- ${i}`).join('\n') + '\n\n';
          hasItem = true;
        }
        
        if (!hasItem) {
          text += '*Kamu tidak memiliki barang yang bisa dijual saat ini.*';
        }
        
        e.setDescription(text);
        message.reply({ embeds: [e] }).catch(() => {});
        return;
      }
      
      const { handleWeaponShopSell } = require('../utils/rpg/weapons');
      const weaponResult = handleWeaponShopSell(db, p, query);
      if (weaponResult) {
        message.reply(weaponResult).catch(() => {});
        return;
      }

      // Fallback: Try GT Items
      const result = sellGtItem(db, p, query);
      message.reply(result).catch(() => {});
      return;
    }

    if (minigameCmd === '!menu' || minigameCmd === '!kota') {
      const { renderDashboard } = require('../utils/rpg/dashboard');
      const { closeOldSession, registerNewSession } = require('../utils/rpg/session');
      const db = loadMinigameDB();
      const player = getPlayer(db, playerIdentifier);

      // Close previous dashboard session if any
      await closeOldSession(message.client, player, db);

      const resp = renderDashboard(player, message.author.username);
      const sentMsg = await message.reply({ embeds: resp.embeds, components: resp.components }).catch(() => null);

      if (sentMsg) {
        registerNewSession(player, sentMsg.id, sentMsg.channelId, db);
      }
      return;
    }

    if (minigameCmd === '!farm') {
      message.reply('🌾 Command `!farm` telah dihapus! Silakan ketik **`!menu`** lalu klik tombol **Farm** secara interaktif.').catch(()=>{});
      return;
    } else if (minigameCmd === '!tavern') {
      const sub = (minigameArgs[1] || '').toLowerCase();
      if (sub === 'rest') {
        doV2Command((db: any, player: any) => handleTavernRest(db, player, playerIdentifier));
      } else if (sub === 'drink') {
        const drinkKey = minigameArgs[2] || '';
        doV2Command((db: any, player: any) => handleTavernDrink(db, player, playerIdentifier, drinkKey));
      } else if (sub === 'board') {
        const db = loadMinigameDB();
        const resp = handleTavernBoard(db, playerIdentifier);
        message.reply(resp as any).catch(()=>{});
      } else {
        doV2Command((db: any, player: any) => handleTavernMenu(db, player));
      }
      return;
    } else if (minigameCmd === '!shop') {
      message.reply('🛒 Command `!shop` telah dihapus! Belanja sekarang diakses melalui **`!menu`** (Inventory/Tempat Terkait) atau melalui markas Kota.').catch(()=>{});
      return;
    }
 else if (minigameCmd === '!dungeon') {
      // Run dungeon then check for Legendary/Epic GT drop to announce
      const dungeonDb = loadMinigameDB();
      const dungeonPlayer = getPlayer(dungeonDb, playerIdentifier);
      const dungeonResult = handleDungeonCampaign(dungeonDb, dungeonPlayer, minigameArgs.slice(1), playerIdentifier, ownerId);
      message.reply(dungeonResult as any).catch(() => {});

      // Check if a GT Legendary/Epic item was just added (last item in gtItems)
      if (message.guild && dungeonPlayer.gtItems && dungeonPlayer.gtItems.length > 0) {
        const lastItem = dungeonPlayer.gtItems[dungeonPlayer.gtItems.length - 1];
        // Check rarity from embed field or announce for Legendary/Epic
        const { announceGtItemDrop } = require('../utils/announcer');
        const DIFFS = ['Normal', 'Hard', 'Nightmare', 'Hell', 'Torment'];
        const diffName = DIFFS[dungeonPlayer.dungeonProgress.difficulty] || 'Normal';
        // We check if the victory embed has a GT Item Drop field
        const fields = (dungeonResult as any).embeds?.[0]?.data?.fields || [];
        const gtField = fields.find((f: any) => f.name?.includes('GT Item Drop'));
        if (gtField) {
          const isLeg = gtField.value?.includes('Legendary');
          const isEpic = gtField.value?.includes('Epic');
          if (isLeg || isEpic) {
            announceGtItemDrop(
              message.guild,
              message.author.id,
              message.author.username,
              lastItem,
              isLeg ? 'Legendary' : 'Epic',
              diffName,
            ).catch(() => {});
          }
        }
      }
      return;
    } else if (minigameCmd === '!equip' || minigameCmd === '!unequip') {
      message.reply('⚔️ Fitur **Equip & Inventory** sekarang ada di **`!menu`** → klik tombol 🎒 **Inventory**!').catch(()=>{});
      return;
    } else if (minigameCmd === '!title') {
      const sub = minigameArgs[1];
      doV2Command((db: any, player: any) => {
        if (!sub || sub === 'list') {
          const tList = player.titles?.join(', ') || 'Belum ada title.';
          return `🏆 Title yang kamu miliki: ${tList}\nKetik \`!title set <nama_title>\` untuk memasang.`;
        }
        if (sub === 'set') {
          const tName = minigameArgs.slice(2).join(' ');
          if (!player.titles?.includes(tName)) {
            return `❌ Kamu belum membuka title tersebut!`;
          }
          player.activeTitle = tName;
          saveMinigameDB(db);
          return `✅ Title berhasil diubah menjadi **${tName}**!`;
        }
        return '';
      });
      return;
    } else if (minigameCmd === '!forge') {
      const itemName = minigameArgs.slice(1).join(' ');
      if (!itemName) {
        message.reply('❌ Gunakan: `!forge <nama_barang>`').catch(()=>{});
        return;
      }
      doV2Command((db: any, player: any) => handleForge(db, player, itemName));
      return;
    } else if (minigameCmd === '!repair') {
      const itemName = minigameArgs.slice(1).join(' ');
      if (!itemName) {
        message.reply("Mau repair apa? Harus persis dengan yang dipakai! Contoh: `!repair Steel Sword`").catch(()=>{});
        return;
      }
      doV2Command((db: any, player: any) => handleRepair(db, player, itemName));
      return;
    } else if (minigameCmd === '!pinjam') {
      const amount = parseInt(minigameArgs[1]);
      if (isNaN(amount)) {
        message.reply("Format salah! Contoh: `!pinjam 50`").catch(()=>{});
        return;
      }
      doV2Command((db: any, player: any) => handleBorrow(db, player, amount));
      return;
    } else if (minigameCmd === '!bayar') {
      const amount = parseInt(minigameArgs[1]);
      if (isNaN(amount)) {
        message.reply("Format salah! Contoh: `!bayar 60`").catch(()=>{});
        return;
      }
      doV2Command((db: any, player: any) => handleRepay(db, player, amount));
      return;
    } else if (minigameCmd === '!trade') {
      const channelId = message.channelId;
      const sub = (minigameArgs[1] || '').toLowerCase();
      const db = loadMinigameDB();

      if (!sub || sub.startsWith('<@')) {
        // !trade @user — init
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
          message.reply('Format salah! Contoh: `!trade @user`').catch(()=>{});
          return;
        }
        const targetId = targetUser.bot ? targetUser.username : targetUser.id;
        const response = handleTradeInit(channelId, playerIdentifier, message.author.username, targetId, targetUser.username);
        message.reply(response).catch(()=>{});
        return;
      }

      if (sub === 'offer') {
        const coins  = parseInt(minigameArgs[2]) || 0;
        const gems = parseInt(minigameArgs[3]) || 0;
        const itemName = minigameArgs.length > 4 ? minigameArgs.slice(4).join(' ') : null;
        const player = getPlayer(db, playerIdentifier);
        const response = handleTradeOffer(db, channelId, playerIdentifier, coins, gems, itemName);
        message.reply(response).catch(()=>{});
        return;
      }

      if (sub === 'status') {
        const response = handleTradeStatus(channelId, db);
        message.reply(response).catch(()=>{});
        return;
      }

      if (sub === 'confirm') {
        const response = handleTradeConfirm(db, channelId, playerIdentifier);
        message.reply(response).catch(()=>{});
        if (response.includes('TRANSAKSI BERHASIL') && message.guild) {
          const { announceTrade } = require('../utils/rpg/alerts');
          announceTrade(message.guild, message.author.username, 'Partner Player', 'Barter Transaction Completed').catch(() => {});
        }
        return;
      }

      if (sub === 'cancel') {
        const response = handleTradeCancel(channelId, playerIdentifier);
        message.reply(response).catch(()=>{});
        return;
      }

      message.reply('Perintah trade tidak dikenal. Gunakan: `!trade @user` / `!trade offer <coins> <gems> [item]` / `!trade status` / `!trade confirm` / `!trade cancel`').catch(()=>{});
      return;
    } else if (minigameCmd === '!job') {
      doV2Command((db: any, player: any) => {
        const response = handleJobCommand(player, minigameArgs.slice(1));
        // Save
        const fs = require('fs');
        fs.writeFileSync(require('path').join(process.cwd(), 'minigame-db.json'), JSON.stringify(db, null, 2), 'utf-8');
        return response;
      });
      return;
    } else if (minigameCmd === '!heal') {
      const db = loadMinigameDB();
      getPlayer(db, playerIdentifier); 
      const response = heal(playerIdentifier);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!gacha') {
      const db = loadMinigameDB();
      getPlayer(db, playerIdentifier); 
      const response = gacha(playerIdentifier);
      const isError = response.embeds && response.embeds[0].data.title?.includes('❌');
      if (isError) {
        message.reply(response).catch(()=>{});
      } else {
        message.reply('🎰 **Mengocok Gacha...** ⏳').then(msg => {
          setTimeout(async () => {
            msg.edit({ content: '✨ **Hasil Gacha:**', embeds: response.embeds }).catch(()=>{});

            // ── World Announcement untuk Epic/Legendary ──
            const embed0 = response.embeds[0];
            const rarity = embed0.data.fields?.[0]?.name?.includes('🌟') ? 'Legendary'
              : embed0.data.fields?.[0]?.name?.includes('💜') ? 'Epic' : null;
            const desc0 = embed0.data.description || '';
            if ((desc0.includes('Legendary') || desc0.includes('Epic')) && message.guild) {
              const fieldName = embed0.data.fields?.[0]?.name || '';
              // Extract item name from field name like "🌟 ⚔️ Dragon Sword (Legendary)"
              const nameMatch = fieldName.match(/\((?:Legendary|Epic)\)/);
              const cleanName = fieldName.replace(/[🌟💜💙💚⬜⚔️🛡️🗡️✨🔥⚡🌙]/gu, '').replace(/\s*\(.*?\)/, '').trim();
              const fieldVal = embed0.data.fields?.[0]?.value || '';
              const atkMatch = fieldVal.match(/ATK \+\*\*(\d+)\*\*/);
              const hpMatch  = fieldVal.match(/HP \+\*\*(\d+)\*\*/);
              await announceGachaPull(
                message.guild,
                message.author.id,
                message.author.username,
                cleanName,
                desc0.includes('Legendary') ? 'Legendary' : 'Epic',
                fieldVal.split('\n')[0] || '',
                atkMatch ? parseInt(atkMatch[1]) : 0,
                hpMatch  ? parseInt(hpMatch[1])  : 0,
              );
            }
          }, 1500);
        }).catch(()=>{});
      }
      return;
    } else if (minigameCmd === '!rob') {
      const db = loadMinigameDB();
      getPlayer(db, playerIdentifier); 
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        message.reply("Mau rampok siapa? Mention orangnya boss! Contoh: `!rob @user`").catch(()=>{});
        return;
      }
      const targetIdentifier = targetUser.bot ? targetUser.username : targetUser.id;
      const response = rob(playerIdentifier, targetIdentifier);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!buy') {
      const db = loadMinigameDB();
      getPlayer(db, playerIdentifier); 
      const item = minigameArgs[1];
      const amountRaw = minigameArgs[2];
      // Support 'max' and 'all' keywords → sentinel 999999
      const amount = (amountRaw === 'max' || amountRaw === 'all') ? 999999 : (parseInt(amountRaw) || 1);
      if (!item) {
        message.reply("Beli apa bang?\n**Contoh:**\n`!buy wl 5` → Beli 5 Coin\n`!buy wl max` → Beli Coin sebanyak-banyaknya\n`!buy worker 3` → Rekrut 3 pekerja\n`!buy dl 1` → Beli 1 DL").catch(()=>{});
        return;
      }
      const response = buy(playerIdentifier, item, amount);
      message.reply(response).catch(()=>{});
      return;
    } else if (minigameCmd === '!tempa' || minigameCmd === '!upgrade') {
      const slot = minigameArgs[1];
      const resp = tempa(playerIdentifier, slot);
      message.reply(resp).catch(()=>{});
      return;
    } else if (minigameCmd === '!craft') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const { handleCrafting } = require('../utils/rpg/crafting');
      const resp = handleCrafting(db, p, minigameArgs.slice(1), playerIdentifier);
      message.reply(resp).catch(()=>{});
      return;
    } else if (minigameCmd === '!auction' || minigameCmd === '!ah') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const { handleAuction } = require('../utils/rpg/auction');
      const resp = handleAuction(db, p, playerIdentifier, message.author.username, minigameArgs.slice(1));
      message.reply(resp).catch(()=>{});
      return;
    } else if (minigameCmd === '!guild' || minigameCmd === '!g') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const { handleGuild } = require('../utils/rpg/guild');
      const resp = handleGuild(db, p, playerIdentifier, message.author.username, minigameArgs.slice(1));
      message.reply(resp).catch(()=>{});
      return;
    } else if (minigameCmd === '!inv' || minigameCmd === '!inventory') {
      message.reply('🎒 Command `!inv` telah dihapus! Silakan ketik **`!menu`** lalu klik tombol **Inventory** untuk melihat isi tas.').catch(()=>{});
      return;
    }


    // Ignore bots and DM/private messages for the rest of the systems
    if (isBot) return;

    const guildId = message.guildId;
    const userId = message.author.id;
    const guild = message.guild!;
    const now = Date.now();

    // ==========================================
    // 1. AUTOMATED ANTI-SPAM PROTECTION
    // ==========================================
    const rateKey = `${guildId}-${userId}`;
    if (!messageRates.has(rateKey)) {
      messageRates.set(rateKey, []);
    }

    const timestamps = messageRates.get(rateKey)!;
    // Filter timestamps to only keep those within the 3-second window
    const recentTimestamps = timestamps.filter(t => now - t < SPAM_THRESHOLD_MS);
    recentTimestamps.push(now);
    messageRates.set(rateKey, recentTimestamps);

    if (recentTimestamps.length > SPAM_MAX_MESSAGES) {
      // User is spamming!
      // Delete the message to clean the chat
      if (message.deletable) {
        await message.delete().catch(() => null);
      }

      // Add a warning in DB
      const botUser = message.client.user!;
      const warning = db.addWarning(guildId, userId, 'Automated Spam Protection: Sending messages too fast (>5 in 3 seconds)', botUser.id);
      const warningsCount = db.getWarnings(guildId, userId).length;

      // Send alert warning message in chat
      const channel = message.channel;
      let warningReply: any = null;
      if (channel && 'send' in channel) {
        warningReply = await (channel as any).send({
          content: `⚠️ <@${userId}>, you are sending messages too fast! Please slow down. (Automated Warn #${warningsCount})`
        }).catch(() => null);
      }

      // Delete the bot's warning alert after 5 seconds to keep chat clean
      if (warningReply) {
        setTimeout(() => warningReply.delete().catch(() => null), 5000);
      }

      // Log the spam action to the mod logs channel
      await logModAction(message.client, guild, '🚨 Auto-Mod: Spam Detected', [
        { name: 'User', value: `${message.author.tag} (<@${userId}>)`, inline: true },
        { name: 'Action Taken', value: 'Deleted message & Issued Auto-Warning', inline: true },
        { name: 'Reason', value: 'Sent more than 5 messages within 3 seconds', inline: false },
        { name: 'Total Warnings', value: `${warningsCount}`, inline: true }
      ], 0xff3300);

      return; // Stop processing (do not award XP)
    }

    // ==========================================
    // 2. AI MENTION HANDLER
    // ==========================================
    const botUserId = message.client.user!.id;
    if (message.mentions.has(botUserId)) {
      await handleAiMention(message, botUserId);
      return; // Do not award XP for just talking to the bot
    }

    // ==========================================
    // 2.1 MEMORY RESET COMMAND
    // ==========================================
    const lowerContent = message.content.toLowerCase();
    if (lowerContent === '!reset' || lowerContent === '!lupakan') {
      clearMemory();
      clearConversationHistory(message.guildId);
      message.reply("🧠 *Zzzzap!* Ingatan bot tentang obrolan sebelumnya dan semua fakta yang dipelajari telah dihapus permanen!").catch(()=>{});
      return;
    }

    // ==========================================
    // 2.3 IHEMO FORWARD PARSING
    // ==========================================
    // Cek apakah pesan panjang mengandung format trade Ihemo (Buy/Sell + Emoji Mata Uang)
    if ((lowerContent.includes('buy ') || lowerContent.includes('sell ')) && message.content.includes('<:')) {
      const savedCount = parseAndSaveTradeList(message.content);
      if (savedCount > 0) {
        logger.info(`Berhasil menyimpan ${savedCount} harga dari Ihemo forward.`, 'DB');
        // Beri reaksi ke pesan agar user tahu data masuk
        message.react('📈').catch(() => {});
        
        // Opsional: ZHU bot (Asisten) konfirmasi singkat
        if (!isSimulationRunning(message.channel.id)) {
          message.reply(`✅ *Database harga terupdate! ${savedCount} item berhasil diingat dari Ihemo.*`).catch(() => {});
        }
      }
    }

    // ==========================================
    // 2.4 IMAGE VISION AI
    // ==========================================
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
        (message.channel as any)?.sendTyping?.().catch(()=>{});
        const visionResult = await analyzeImage(attachment.url, message.author.username);
        message.reply(visionResult).catch(()=>{});
        return; // Stop processing so we don't trigger regular AI/XP
      }
    }
    if (minigameCmd === '!map') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const world = loadWorldDB();
      const subcmd = minigameArgs[1]?.toLowerCase();
      
      if (subcmd === 'travel') {
        const targetId = minigameArgs[2];
        const targetRegion = world.regions[targetId];
        if (!targetRegion) {
          message.reply('❌ Region tidak ditemukan. Gunakan `!map` untuk melihat daftar region (ID).');
          return;
        }
        if (p.currentRegion === targetRegion.name) {
          message.reply('❌ Kamu sudah berada di region ini.');
          return;
        }
        if (p.coins < 10) {
          message.reply('❌ Kamu butuh 10 Coin untuk biaya travel.');
          return;
        }
        p.coins -= 10;
        p.currentRegion = targetRegion.name;
        saveMinigameDB(db);
        message.reply(`🗺️ Kamu telah bepergian ke **${targetRegion.name}**. Biaya: 10 Coin.`);
        return;
      }

      const mapEmbed = new EmbedBuilder()
        .setColor(0x2980B9)
        .setTitle('🗺️ PETA DUNIA (REGIONS)')
        .setDescription(`Lokasi Kamu Saat Ini: **${p.currentRegion}**\nGunakan \`!map travel <region_id>\` (Biaya 10 Coin) untuk pindah.\n`);
      
      let rText = '';
      for (const [rid, rdata] of Object.entries(world.regions)) {
        const factionName = rdata.controller ? world.factions[rdata.controller]?.name || 'Unknown' : 'Pemberontak / Bebas';
        rText += `**[${rid}] ${rdata.name}**\n👑 Penguasa: ${factionName} | Bonus: ${rdata.resourceBonus}\n\n`;
      }
      mapEmbed.addFields({ name: 'Daftar Wilayah', value: rText });
      
      message.reply({ embeds: [mapEmbed] });
      return;
    }

    if (minigameCmd === '!faksi' || minigameCmd === '!faction') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const world = loadWorldDB();
      const subcmd = minigameArgs[1]?.toLowerCase();

      if (subcmd === 'list') {
        const emb = new EmbedBuilder().setColor(0x8B0000).setTitle('⚔️ DAFTAR FAKSI GLOBAL');
        let text = '';
        for (const [fid, fdata] of Object.entries(world.factions)) {
           const terr = Object.values(world.regions).filter(r => r.controller === fid).length;
           text += `**[${fid}] ${fdata.name}**\nStatus: ${fdata.state} | Wilayah: ${terr} Region | Kekayaan: ${fdata.resources}\nIdeologi: ${fdata.ideology}\n\n`;
        }
        emb.setDescription('Gunakan `!faksi join <id>` untuk bergabung.\n\n' + text);
        message.reply({ embeds: [emb] });
        return;
      }

      if (subcmd === 'join') {
        const targetId = minigameArgs[2];
        if (!world.factions[targetId]) {
          message.reply('❌ Faksi tidak ditemukan.');
          return;
        }
        if (p.factionId === targetId) {
          message.reply('❌ Kamu sudah berada di faksi ini.');
          return;
        }
        p.factionId = targetId;
        saveMinigameDB(db);
        message.reply(`🛡️ Kamu telah bergabung dengan **${world.factions[targetId].name}**!`);
        return;
      }

      if (subcmd === 'donate') {
        const amount = parseInt(minigameArgs[2]);
        if (!amount || amount < 1 || p.coins < amount) {
          message.reply('❌ Jumlah Coin tidak valid atau tidak cukup.');
          return;
        }
        if (!p.factionId || !world.factions[p.factionId]) {
          message.reply('❌ Kamu belum bergabung dengan faksi apapun.');
          return;
        }
        p.coins -= amount;
        world.factions[p.factionId].resources += amount * 10;
        saveMinigameDB(db);
        saveWorldDB(world);
        message.reply(`🤝 Kamu menyumbangkan **${amount} Coin**! Kekuatan faksi bertambah ${amount * 10}.`);
        return;
      }

      if (subcmd === 'simulate') {
        const logs = simulateFactionTick(world);
        if (logs.length > 0) {
          const ann = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('📢 [GLOBAL ANNOUNCEMENT] PERGOLAKAN DUNIA')
            .setDescription(logs.join('\n\n'));
          
          let annChannel = message.guild?.channels.cache.find(c => c.name === 'global-announcements') as any;
          if (!annChannel && message.guild) {
            try {
              annChannel = await message.guild.channels.create({ name: 'global-announcements', type: 0 });
            } catch (e) {}
          }
          if (annChannel) annChannel.send({ embeds: [ann] }).catch(()=>{});
          else (message.channel as any)?.send({ embeds: [ann] }).catch(()=>{});

          message.reply('⚔️ Simulasi Faksi selesai. Cek channel global announcements.');
        } else {
          message.reply('🕊️ Simulasi Faksi selesai. Dunia masih damai (untuk saat ini).');
        }
        return;
      }

      message.reply('❓ Sub-command faksi tidak valid. Gunakan: `list`, `join`, `donate`, `simulate`.');
      return;
    }

    if (minigameCmd === '!swarm') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const sub = minigameArgs[1]?.toLowerCase();
      if (sub === 'catch') {
        const result = handleSwarmCatch(p, db);
        message.reply(result);
        return;
      }
      message.reply('❓ Gunakan: `!swarm catch`');
      return;
    }

    if (minigameCmd === '!zoo') {
      const db = loadMinigameDB();
      const p = getPlayer(db, playerIdentifier);
      const sub = minigameArgs[1]?.toLowerCase();
      const result = handleZoo(p, sub, db);
      message.reply(result);
      return;
    }

    // ==========================================
    // 2.5 SELF-LEARNING & HUMAN INTERACTION
    // ==========================================
    if (isSimulationRunning(message.channel.id)) {
      // 1. Force the simulation to reply to the human immediately (with a 2-4s delay)
      // This will parse replies and name mentions internally
      forceSimulationTick(message);

      // 2. Extract facts in the background if message is long enough
      if (message.content.length >= 10) {
        extractFactFromMessage(message.author.username, message.content).catch(err => {
          logger.error(`Error in background memory extraction: ${err}`, 'Memory');
        });
      }
    }

    // ==========================================
    // 3. LEVELING & XP ENGINE
    // ==========================================
    const userData = db.getUser(guildId, userId);

    // Check XP Cooldown
    if (now - userData.lastMessageTimestamp < COOLDOWN_MS) {
      return;
    }

    // Generate random XP between 15 and 25
    const xpGained = Math.floor(Math.random() * 11) + 15;
    let newXp = userData.xp + xpGained;
    let currentLevel = userData.level;
    let xpNeeded = getXpForLevel(currentLevel);

    let leveledUp = false;

    // Handle level ups (supports multi-level jumps if they gain massive XP)
    while (newXp >= xpNeeded) {
      newXp -= xpNeeded;
      currentLevel++;
      xpNeeded = getXpForLevel(currentLevel);
      leveledUp = true;
    }

    // Save state
    db.updateUser(guildId, userId, {
      xp: newXp,
      level: currentLevel,
      lastMessageTimestamp: now,
    });

    if (leveledUp) {
      logger.info(`${message.author.tag} leveled up to Level ${currentLevel} in guild: ${guildId}`, 'Leveling');
      
      const embed = new EmbedBuilder()
        .setColor(0x00ffcc) // Vibrant neon teal
        .setTitle('🎉 Level Up!')
        .setDescription(`Congratulations <@${userId}>, you've reached **Level ${currentLevel}**!`)
        .setThumbnail(message.author.displayAvatarURL({ forceStatic: false }))
        .addFields(
          { name: 'Next Goal', value: `${newXp} / ${xpNeeded} XP`, inline: true }
        )
        .setTimestamp();

      // Check level role rewards config
      const guildSettings = db.getGuildSettings(guildId);
      let roleRewardMessage = '';

      if (guildSettings.levelRoles && guildSettings.levelRoles[currentLevel.toString()]) {
        const roleId = guildSettings.levelRoles[currentLevel.toString()];
        const role = guild.roles.cache.get(roleId);
        
        if (role) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            await member.roles.add(role)
              .then(() => {
                roleRewardMessage = `\n🎁 You have unlocked the **${role.name}** role reward!`;
                embed.addFields({ name: 'Role Unlocked', value: `🛡️ **${role.name}**`, inline: true });
              })
              .catch((err) => {
                logger.error(`Failed to assign level role reward ${role.name} to ${message.author.tag}:`, 'Leveling');
                logger.error(err);
              });
          }
        }
      }

      if (roleRewardMessage) {
        embed.setDescription(`Congratulations <@${userId}>, you've reached **Level ${currentLevel}**!${roleRewardMessage}`);
      }

      const channel = message.channel;
      if (channel && 'send' in channel) {
        await (channel as any).send({ embeds: [embed] }).catch((error: any) => {
          logger.error('Failed to send level up announcement:', 'Leveling');
          logger.error(error as Error);
        });
      }
    }
  },
};

export default messageCreateEvent;
