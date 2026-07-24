import { Interaction, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { logger } from '../logger';
import { utilityCommands } from '../commands/utility';
import { levelingCommands } from '../commands/leveling';
import { moderationCommands } from '../commands/moderation';
import { economyCommands } from '../commands/economy';
import { gamesCommands } from '../commands/games';
import { growtopiaCommands, handleTradeModal, handleTradeBuySelect, handleTradeSellSelect, handleTradeConfirmBtn, handleTradeSearchBtn, handleTradeSearchModal } from '../commands/growtopia';
import { Command, BotEvent } from '../types';
import { loadMinigameDB, getPlayer, buy, setPlayerName, saveMinigameDB } from '../utils/minigame';
import { handleShopMenu, handleShopCategory, buildShopBuyEmbed } from '../utils/rpg/shop';
import { handleWeaponShopPage, handleWeaponShopBuy } from '../utils/rpg/weapons';
import { handleBossAction } from '../utils/rpg/dungeon_v2';
import { db } from '../database';

const commandsMap = new Map<string, Command>();

const allCommands = [
  ...utilityCommands,
  ...levelingCommands,
  ...moderationCommands,
  ...economyCommands,
  ...gamesCommands,
  ...growtopiaCommands,
];

for (const cmd of allCommands) {
  commandsMap.set(cmd.data.name, cmd);
}

const interactionCreateEvent: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    // Auto-save Discord username for every interaction
    if ('user' in interaction && interaction.user) {
      try {
        const _db = loadMinigameDB();
        const _uid = interaction.user.id;
        // Only update if player already exists in DB (avoid creating empty entries)
        if (_db[_uid]) {
          const displayName = interaction.user.username;
          setPlayerName(_db, _uid, displayName);
        }
      } catch (_e) { /* ignore */ }
    }

    // ==========================================
    // 1. HANDLE BUTTON INTERACTIONS
    // ==========================================
    if (interaction.isButton()) {
      try {
      const guildId = interaction.guildId;
      const guild = interaction.guild;

      // Dungeon START from dashboard (create fresh battle)
      if (interaction.customId === 'dngstart' || interaction.customId === 'bossstart') {
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        if (player.hp <= 0) {
          await interaction.reply({ content: 'HP kamu 0! Lakukan `!heal` atau `!tavern rest` terlebih dahulu.', ephemeral: true });
          return;
        }
        const { handleDungeonCampaign } = require('../utils/rpg/dungeon_v2');
        const args = interaction.customId === 'bossstart' ? ['boss'] : [];
        const resp = handleDungeonCampaign(db, player, args, interaction.user.id);
        await interaction.update(resp as any);
        return;
      }

      // Dungeon Normal FSM
      if (['dngatk', 'dngdef', 'dngheal', 'dngflee', 'dngskill'].includes(interaction.customId)) {
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        if (!player.activeDungeonBattle) {
           await interaction.reply({ content: 'Pertarungan dungeon sudah usai atau tidak aktif.', ephemeral: true });
           return;
        }
        
        const { handleDungeonAction } = require('../utils/rpg/dungeon_v2');
        const resp = handleDungeonAction(db, player, interaction.customId, interaction.user.id);
        
        // --- THREAD CREATION LOGIC ---
        if (interaction.channel && !interaction.channel.isThread() && interaction.channel.type === 0) { // 0 is GuildText
            try {
                const threadName = `⚔️ Battle: ${interaction.user.username} vs ${player.activeDungeonBattle?.name || 'Monster'}`;
                
                // Update original message
                await interaction.update({ content: `Pertarungan sangat sengit! Berpindah ke Thread ⬇️`, embeds: [], components: [] });
                
                // Create a thread on that message
                const thread = await interaction.message.startThread({
                    name: threadName,
                    autoArchiveDuration: 60,
                    reason: 'Dungeon Battle Instance'
                });
                
                // Send the battle state to the thread
                await thread.send(resp as any);
                return;
            } catch (err) {
                logger.error(`Failed to create battle thread: ${err}`, 'Dungeon');
                // Fallback to normal update if missing permissions
            }
        }
        // ------------------------------
        
        if (!resp.components) { // battle over (no components returned)
           await interaction.update({ embeds: resp.embeds, components: [] });
           
           // Auto-archive thread after battle ends (wait 5s so they can read it)
           if (interaction.channel && interaction.channel.isThread()) {
               setTimeout(() => {
                   (interaction.channel as any)?.setArchived(true, 'Battle ended').catch(()=>{});
               }, 5000);
           }
        } else {
           await interaction.update(resp as any);
        }
        return;
      }

      // Open Private Dashboard (Proxy from !menu)
      if (interaction.customId === 'open_private_dashboard') {
        const { renderDashboard } = require('../utils/rpg/dashboard');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = renderDashboard(player, interaction.user.username);
        
        // This is the magic! Respond ephemerally so only the clicker sees it
        await interaction.reply({ ...resp, ephemeral: true });
        return;
      }

      // Dashboard FSM
      if (interaction.customId.startsWith('dash_')) {
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);

        if (player.activeSession && player.activeSession.messageId && interaction.message.id !== player.activeSession.messageId) {
          await interaction.message.delete().catch(async () => {
            const { EmbedBuilder } = require('discord.js');
            const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0] || {})
              .setColor(0x808080)
              .setTitle(`🔒 [SESI DITUTUP] ${interaction.message.embeds[0]?.title?.replace('🔒 [SESI DITUTUP] ', '') || 'Kerajaan'}`)
              .setDescription(`🔒 **Sesi dashboard lama ini telah ditutup.**\nAnda memiliki Sesi Dashboard Baru yang aktif. Silakan gunakan pesan dashboard terbaru Anda, atau ketik \`!menu\` untuk membuka sesi baru!`);

            await interaction.update({ embeds: [oldEmbed], components: [] }).catch(() => null);
          });
          return;
        }

        if (!player.activeSession) {
          player.activeSession = { channelId: interaction.channelId, messageId: interaction.message.id };
          saveMinigameDB(db);
        }

        await interaction.deferUpdate().catch(() => null);
        const action = interaction.customId.replace('dash_', '');
        const { handleDashboardAction } = require('../utils/rpg/dashboard');
        const resp = await handleDashboardAction(db, player, action, interaction.user.username);
        
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(resp as any).catch(() => null);
        } else {
          await interaction.update(resp as any).catch(() => null);
        }
        return;
      }

      // Faction selection FSM
      if (interaction.customId.startsWith('fact_join_')) {
        const factionKey = interaction.customId.replace('fact_join_', '') as 'Shu' | 'Wei' | 'Wu';
        const { handleFactionJoin } = require('../utils/rpg/factions');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleFactionJoin(db, player, factionKey, interaction.user.username);
        
        if (interaction.guild) {
          const roleName = factionKey === 'Shu' ? 'Shu Han Faction' : (factionKey === 'Wei' ? 'Cao Wei Faction' : 'Eastern Wu Faction');
          let role = interaction.guild.roles.cache.find(r => r.name === roleName);
          if (!role) {
            try {
              role = await interaction.guild.roles.create({
                name: roleName,
                color: factionKey === 'Shu' ? 0x2ecc71 : (factionKey === 'Wei' ? 0x3498db : 0xe74c3c),
                reason: 'Faction selection role'
              });
            } catch (err) {}
          }
          if (role) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member) {
              await member.roles.add(role).catch(() => null);
            }
          }
        }

        await interaction.update(resp as any).catch(() => null);
        return;
      }

      // Town FSM
      if (interaction.customId.startsWith('town_')) {
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);

        if (player.activeSession && player.activeSession.messageId && interaction.message.id !== player.activeSession.messageId) {
          await interaction.message.delete().catch(async () => {
            const { EmbedBuilder } = require('discord.js');
            const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0] || {})
              .setColor(0x808080)
              .setTitle(`🔒 [SESI DITUTUP] ${interaction.message.embeds[0]?.title?.replace('🔒 [SESI DITUTUP] ', '') || 'Kerajaan'}`)
              .setDescription(`🔒 **Sesi dashboard lama ini telah ditutup.**\nAnda memiliki Sesi Dashboard Baru yang aktif. Silakan gunakan pesan dashboard terbaru Anda, atau ketik \`!menu\` untuk membuka sesi baru!`);

            await interaction.update({ embeds: [oldEmbed], components: [] }).catch(() => null);
          });
          return;
        }

        if (!player.activeSession) {
          player.activeSession = { channelId: interaction.channelId, messageId: interaction.message.id };
          saveMinigameDB(db);
        }

        if (interaction.customId === 'town_deploy_dungeon' || interaction.customId === 'town_deploy_boss') {
          const { deployArmyModal } = require('../utils/rpg/deployments');
          const targetType = interaction.customId.includes('dungeon') ? 'DUNGEON' : 'WORLD_BOSS';
          await interaction.showModal(deployArmyModal(interaction.user.id, targetType)).catch(() => null);
          return;
        }

        await interaction.deferUpdate().catch(() => null);
        const action = interaction.customId.replace('town_', '');
        const { handleTownAction, renderTownMenu } = require('../utils/rpg/town');
        const resp = action === 'main'
          ? renderTownMenu(player, interaction.user.username, db)
          : await handleTownAction(db, player, action, interaction.user.username, interaction.guild);

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(resp as any).catch(() => null);
        } else {
          await interaction.update(resp as any).catch(() => null);
        }
        return;
      }

      // Inventory FSM (equip/unequip dari !menu -> Inventory)
      if (interaction.customId.startsWith('inv_')) {
        const action = interaction.customId.replace('inv_', '');
        const { handleDashboardAction } = require('../utils/rpg/dashboard');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleDashboardAction(db, player, 'inv_' + action, interaction.user.username);
        await interaction.update(resp as any);
        return;
      }

      // Campaign Story FSM
      if (interaction.customId.startsWith('camp_')) {
        const action = interaction.customId.replace('camp_', '');
        const { handleCampaignAction } = require('../utils/rpg/campaign');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleCampaignAction(db, player, action, interaction.user.username);
        await interaction.update(resp as any);
        return;
      }

      // Fast Trade FSM
      if (interaction.customId.startsWith('trade_')) {
        const action = interaction.customId.replace('trade_', '');
        const { handleTradeAction } = require('../utils/rpg/trade_p2p');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleTradeAction(db, player, action, interaction.user.username);
        await interaction.update(resp as any);
        return;
      }

      // Market FSM
      if (interaction.customId.startsWith('market_')) {
        const action = interaction.customId.replace('market_', '');
        const { handleMarketAction } = require('../utils/rpg/market');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleMarketAction(db, player, action, interaction.user.username);
        await interaction.update(resp as any);
        return;
      }

      // Arena FSM
      if (interaction.customId.startsWith('arena')) {
        const action = interaction.customId.replace('arena', '');
        const { handleArenaAction } = require('../utils/rpg/arena');
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        const resp = handleArenaAction(db, player, action, interaction.user.id);
        
        if (!resp.components || resp.components.length === 0) {
          await interaction.update({ embeds: resp.embeds, components: [], content: resp.content || '' });
        } else {
          await interaction.update(resp as any);
        }
        return;
      }

      // Boss FSM
      if (interaction.customId.startsWith('bossatk_') || interaction.customId.startsWith('bossdef_') || interaction.customId.startsWith('bossheal_') || interaction.customId.startsWith('bossskill_')) {
        const parts = interaction.customId.split('_');
        const actionType = parts[0].replace('boss', '');
        const baseDmg = parseInt(parts[1]) || 10;
        
        const actStr = actionType === 'atk' ? 'attack' : (actionType === 'def' ? 'defend' : (actionType === 'skill' ? 'skill' : 'heal'));
        const db = loadMinigameDB();
        const player = getPlayer(db, interaction.user.id);
        
        if (!player.activeBossBattle) {
           await interaction.reply({ content: 'Pertarungan boss sudah usai.', ephemeral: true });
           return;
        }
        
        const resp = handleBossAction(db, player, actStr, baseDmg);
        await interaction.update(resp as any);
        
        // Global Announcer
        if (resp.embeds && resp.embeds[0].data.title?.includes('BOSS DIKALAHKAN!')) {
          const ann = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('📢 [GLOBAL ANNOUNCEMENT]')
            .setDescription(`Pemain **<@${interaction.user.id}>** baru saja menaklukkan Boss!\nDunia aman dari ancaman untuk sementara waktu.`);
          
          let annChannel = interaction.guild?.channels.cache.find(c => c.name === 'global-announcements') as any;
          if (!annChannel && interaction.guild) {
            try {
              annChannel = await interaction.guild.channels.create({ name: 'global-announcements', type: 0 });
            } catch (e) {}
          }
          if (annChannel) annChannel.send({ embeds: [ann] }).catch(()=>{});
          else (interaction.channel as any)?.send({ embeds: [ann] }).catch(()=>{});
        }
        
        return;
      }

      // Handle trconfirm button (both mode)
      if (interaction.customId.startsWith('trconfirm:')) {
        await handleTradeConfirmBtn(interaction);
        return;
      }
      // Handle trsearch button (open search modal)
      if (interaction.customId.startsWith('trsearch:')) {
        await handleTradeSearchBtn(interaction);
        return;
      }
      if (interaction.customId === 'stop-ad-posting') {
        if (!guildId) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: '❌ Only administrators can stop the automated ad posting.',
            ephemeral: true
          });
          return;
        }

        try {
          db.updateGuildSettings(guildId, {
            adChannelId: undefined,
          });

          logger.info(`Automated ad posting stopped by admin ${interaction.user.tag} in guild ${guildId}`, 'Scheduler');

          const disabledButton = new ButtonBuilder()
            .setCustomId('stop-ad-posting-disabled')
            .setLabel('Ad Posting Stopped')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛑')
            .setDisabled(true);

          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

          await interaction.update({
            components: [disabledRow]
          });

          if (interaction.channel && 'send' in interaction.channel) {
            await (interaction.channel as any).send({
              content: `🛑 **Automated Ad Posting has been stopped** by ${interaction.user.toString()}. To restart, run \`/config ad-setup\` again.`
            });
          }
        } catch (error) {
          logger.error('Error handling stop-ad-posting button:', 'Interaction');
          logger.error(error as Error);
        }
      }

      // Handle role approval responses (Approve or Decline)
      if (interaction.customId.startsWith('approve-role_') || interaction.customId.startsWith('decline-role_')) {
        if (!guildId || !guild) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== guild.ownerId) {
          await interaction.reply({
            content: '❌ Hanya Owner dan Admin yang dapat menyetujui permintaan ini.',
            ephemeral: true
          });
          return;
        }

        const parts = interaction.customId.split('_');
        const action = parts[0];
        const targetUserId = parts[1];
        const targetRoleId = parts[2];

        try {
          const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
          const targetRole = await guild.roles.fetch(targetRoleId).catch(() => null);

          if (!targetRole) {
            await interaction.reply({ content: '❌ Role tidak ditemukan di server.', ephemeral: true });
            return;
          }

          if (action === 'approve-role') {
            if (targetMember) {
              await targetMember.roles.add(targetRole);
              await targetMember.send({
                content: `🎉 Permintaan Anda untuk bergabung dengan role **${targetRole.name}** di server **${guild.name}** telah **DISETUJUI**!`
              }).catch(() => null);
            }

            const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(0x00ff99)
              .setTitle('✅ Permintaan Bergabung Disetujui')
              .setDescription(interaction.message.embeds[0].description + `\n\n**Status:** Disetujui oleh ${interaction.user.toString()}`);

            await interaction.update({
              embeds: [approvedEmbed],
              components: []
            });
          } else {
            if (targetMember) {
              await targetMember.send({
                content: `❌ Permintaan Anda untuk bergabung dengan role **${targetRole.name}** di server **${guild.name}** telah ditolak oleh admin.`
              }).catch(() => null);
            }

            const declinedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(0xff3300)
              .setTitle('❌ Permintaan Bergabung Ditolak')
              .setDescription(interaction.message.embeds[0].description + `\n\n**Status:** Ditolak oleh ${interaction.user.toString()}`);

            await interaction.update({
              embeds: [declinedEmbed],
              components: []
            });
          }
        } catch (error) {
          logger.error('Error handling role approval button:', 'Interaction');
          logger.error(error as Error);
          await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses keputusan.', ephemeral: true });
        }
      }

      // Handle Self-Roles claim buttons
      if (interaction.customId.startsWith('selfrole-')) {
        const roleId = interaction.customId.replace('selfrole-', '');
        const member = interaction.member;

        if (!member || !('roles' in member) || !guild) return;

        const unverifyRoleId = '1419859273739010139';
        const hasUnverifyRole = (member.roles as any).cache.has(unverifyRoleId);

        if (hasUnverifyRole) {
          await interaction.reply({
            content: '⚠️ Anda harus menyelesaikan verifikasi Double Counter terlebih dahulu sebelum dapat mengambil role!',
            ephemeral: true
          });
          return;
        }

        try {
          const role = await guild.roles.fetch(roleId);
          if (!role) {
            await interaction.reply({ content: '❌ Role tidak ditemukan di server.', ephemeral: true });
            return;
          }

          const hasRole = (member.roles as any).cache.has(roleId);

          if (role.name === 'Guild Member') {
            if (hasRole) {
              await (member.roles as any).remove(role);
              await interaction.reply({ content: `❌ Anda telah keluar dari role **${role.name}**.`, ephemeral: true });
            } else {
              const guildSettings = db.getGuildSettings(guild.id);
              
              let logChannel: any = null;
              if (guildSettings.modLogChannelId) {
                logChannel = await guild.channels.fetch(guildSettings.modLogChannelId).catch(() => null);
              }
              if (!logChannel) {
                logChannel = guild.channels.cache.find(c => 
                  c.isTextBased() && (c.name.includes('mod-log') || c.name.includes('admin') || c.name.includes('verification'))
                );
              }

              if (!logChannel) {
                await interaction.reply({
                  content: '❌ Fitur persetujuan admin belum siap. Admin harus mengatur channel log terlebih dahulu menggunakan `/config mod-log`.',
                  ephemeral: true
                });
                return;
              }

              const requestEmbed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('📝 Permintaan Bergabung (Guild Member)')
                .setDescription(
                  `User <@${interaction.user.id}> (${interaction.user.tag}) meminta untuk bergabung dengan role **Guild Member**.\n\n` +
                  `Silakan setujui atau tolak permintaan ini menggunakan tombol di bawah.`
                )
                .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
                .setTimestamp();

              const approveBtn = new ButtonBuilder()
                .setCustomId(`approve-role_${interaction.user.id}_${role.id}`)
                .setLabel('Setujui / Approve')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

              const declineBtn = new ButtonBuilder()
                .setCustomId(`decline-role_${interaction.user.id}_${role.id}`)
                .setLabel('Tolak / Decline')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

              const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, declineBtn);

              await logChannel.send({ embeds: [requestEmbed], components: [row] });

              await interaction.reply({
                content: `✅ Permintaan Anda untuk mendapatkan role **Guild Member** telah dikirim ke Owner/Admin untuk diverifikasi. Silakan tunggu persetujuan mereka!`,
                ephemeral: true
              });
            }
            return;
          }

          if (hasRole) {
            await (member.roles as any).remove(role);
            await interaction.reply({ content: `❌ Menghapus role **${role.name}** dari Anda.`, ephemeral: true });
          } else {
            await (member.roles as any).add(role);
            await interaction.reply({ content: `✅ Menambahkan role **${role.name}** ke Anda!`, ephemeral: true });
          }
        } catch (error) {
          logger.error(`Error toggling selfrole ${roleId}:`, 'Interaction');
          logger.error(error as Error);

          const errMsg = { content: '❌ Gagal memperbarui role Anda. Pastikan posisi role bot (ZHU-Assistance) berada di atas role yang ingin diberikan dalam pengaturan Server.', ephemeral: true };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errMsg).catch(() => null);
          } else {
            await interaction.reply(errMsg).catch(() => null);
          }
        }
      }

      // ── SHOP CATEGORY AND SHOP BUY BUTTONS ──
      if (interaction.customId.startsWith('shopcat_') || interaction.customId.startsWith('shopbuy_')) {
        try {
          const db = loadMinigameDB();
          const player = getPlayer(db, interaction.user.id);

          // Category navigation
          if (interaction.customId.startsWith('shopcat_')) {
            const cat = interaction.customId.replace('shopcat_', '');
            if (cat === 'main') {
              const resp = handleShopMenu(db, player);
              await interaction.update(resp);
            } else if (['currency', 'consumable', 'economy', 'legacy'].includes(cat)) {
              const resp = handleShopCategory(db, player, cat);
              await interaction.update(resp);
            } else if (cat.startsWith('wp_')) {
              const weaponCat = cat.replace('wp_', '');
              const resp = handleWeaponShopPage(db, player, weaponCat);
              await interaction.update(resp);
            }
            return;
          }

          // Purchase buttons
          if (interaction.customId.startsWith('shopbuy_')) {
            const action = interaction.customId.replace('shopbuy_', '');
            // format: item_amount (e.g. wl_1, medkit_5)
            const parts = action.split('_');
            const item = parts[0];
            const amountRaw = parts[1];
            
            if (item === 'legacy') {
              // legacy weapon or pickaxe upgrade
              const type = parts[1]; // weapon or pickaxe
              const buyResult = buy(interaction.user.id, type, 1);
              const db2 = loadMinigameDB();
              const player2 = getPlayer(db2, interaction.user.id);
              const success = !buyResult.startsWith('❌') && !buyResult.startsWith('Miskin') && !buyResult.startsWith('Kurang') && !buyResult.startsWith('Barang');
              
              const embedResp = buildShopBuyEmbed(buyResult, success, player2);
              // Provide a back button to the category menu
              const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shopcat_legacy').setLabel('Kembali ke Shop').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
              );
              await interaction.update({ embeds: embedResp.embeds, components: [backRow] as any });
            } else if (item === 'wp') {
              // weapon purchase from catalog (e.g., shopbuy_wp_iron_sword)
              const itemId = parts.slice(1).join('_'); // Get everything after wp_
              const db2 = loadMinigameDB();
              const player2 = getPlayer(db2, interaction.user.id);
              const resp = handleWeaponShopBuy(db2, player2, itemId);
              const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shopcat_wp_weapon').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
              );
              await interaction.update({ embeds: resp.embeds, components: [backRow] as any });
            } else {
              const amount = amountRaw === 'max' ? 999999 : (parseInt(amountRaw) || 1);
              const buyResult = buy(interaction.user.id, item, amount);
              const db2 = loadMinigameDB();
              const player2 = getPlayer(db2, interaction.user.id);
              const success = !buyResult.startsWith('❌') && !buyResult.startsWith('Miskin') && !buyResult.startsWith('Kurang') && !buyResult.startsWith('Barang');
              
              const embedResp = buildShopBuyEmbed(buyResult, success, player2);
              const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shopcat_main').setLabel('Kembali ke Shop').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
              );
              await interaction.update({ embeds: embedResp.embeds, components: [backRow] as any });
            }
            return;
          }
        } catch (err) {
          logger.error('Error handling shop button click: ' + err);
        }
      }

      // Handle trade sold button click
      if (interaction.customId.startsWith('trade-sold_')) {
        const authorId = interaction.customId.replace('trade-sold_', '');
        const isAuthor = interaction.user.id === authorId;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!isAuthor && !isAdmin) {
          await interaction.reply({
            content: '❌ Hanya penjual yang memposting iklan ini (atau Admin) yang dapat menandainya sebagai terjual.',
            ephemeral: true
          });
          return;
        }

        try {
          const oldEmbed = interaction.message.embeds[0];
          if (!oldEmbed) return;

          // Clone and rebuild embed to reflect SOLD state
          const soldEmbed = EmbedBuilder.from(oldEmbed)
            .setColor(0x808080) // Set color to gray
            .setTitle('📦 [SOLD] Iklan Dagangan Resmi')
            .addFields(
              { name: '🔴 Status', value: `**TERJUAL / SOLD** (Ditandai oleh ${interaction.user.toString()})` }
            );

          await interaction.update({
            embeds: [soldEmbed],
            components: [] // Removes the button completely!
          });
        } catch (error) {
          logger.error('Error handling trade-sold button click:', 'Interaction');
          logger.error(error as Error);
        }
      }
      return;
    } catch (err) {
      logger.error(`Error in button interaction: ${err}`, 'Interaction');
      logger.error(err as Error);
      const errMsg = { content: '❌ Terjadi kesalahan internal saat memproses tombol.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg).catch(() => null);
      } else {
        await interaction.reply(errMsg).catch(() => null);
      }
    }
  }

    // ==========================================
    // 1b. HANDLE STRING SELECT MENUS
    // ==========================================
    if (interaction.isStringSelectMenu()) {
      try {
        // ── WEAPON SELECT SHOP PURCHASE ──
        if (interaction.customId === 'shopbuy_weaponselect') {
          try {
            const db = loadMinigameDB();
            const player = getPlayer(db, interaction.user.id);
            const itemId = interaction.values[0];

            const resp = handleWeaponShopBuy(db, player, itemId);
            // Return a button to go back to weapon shop
            const backRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('shopcat_wp_weapon').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: resp.embeds, components: [backRow] as any });
          } catch (err) {
            logger.error('Error in weapon select purchase: ' + err);
          }
          return;
        }

        if (interaction.customId.startsWith('trbuy:')) {
          await handleTradeBuySelect(interaction);
        } else if (interaction.customId.startsWith('trsell:')) {
          await handleTradeSellSelect(interaction);
        }
      } catch (err) {
        logger.error('Error in select menu interaction: ' + err);
      }
      return;
    }

    // ==========================================
    // 2. HANDLE MODAL SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId.startsWith('trmodal:')) {
          const tradingChannelId = '1419848898293268488';
          await handleTradeModal(interaction, tradingChannelId);
        } else if (interaction.customId.startsWith('trsearchmodal:')) {
          await handleTradeSearchModal(interaction);
        } else if (interaction.customId.startsWith('modal_deploy_')) {
          const parts = interaction.customId.split('_');
          const targetType = parts[2].toUpperCase() as 'DUNGEON' | 'WORLD';
        const finalTargetType = targetType === 'WORLD' ? 'WORLD_BOSS' : 'DUNGEON';
        const troops = {
          infantry: parseInt(interaction.fields.getTextInputValue('input_infantry')) || 0,
          archers: parseInt(interaction.fields.getTextInputValue('input_archers')) || 0,
          cavalry: parseInt(interaction.fields.getTextInputValue('input_cavalry')) || 0,
          spearmen: parseInt(interaction.fields.getTextInputValue('input_spearmen')) || 0,
          catapults: parseInt(interaction.fields.getTextInputValue('input_catapults')) || 0,
        };
        const { loadMinigameDB } = require('../utils/minigame');
        const db = loadMinigameDB();
        const { handleDeployArmySubmit } = require('../utils/rpg/deployments');
        const embed = handleDeployArmySubmit(db, interaction.user.id, finalTargetType, troops);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      } catch (err) {
        logger.error(`Error in ModalSubmit interaction: ${err}`, 'Interaction');
        const errMsg = { content: '❌ Terjadi kesalahan internal saat memproses form.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => null);
        } else {
          await interaction.reply(errMsg).catch(() => null);
        }
      }
      return;
    }

    // ==========================================
    // 3. HANDLE AUTOCOMPLETE
    // ==========================================
    if (interaction.isAutocomplete()) {
      const command = commandsMap.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Error autocomplete for /${interaction.commandName}:`, 'Interaction');
        logger.error(error as Error);
      }
      return;
    }

    // ==========================================
    // 3. HANDLE SLASH COMMANDS
    // ==========================================
    if (!interaction.isChatInputCommand()) return;

    // ── /bot playgame / stop ──
    if (interaction.commandName === 'bot') {
      const sub = interaction.options.getSubcommand(false);
      const { botStatusChannels } = require('../events/ready');

      if (sub === 'playgame') {
        const channelId = interaction.channelId;
        const guildId = interaction.guildId || '';
        botStatusChannels.set(guildId, { channelId, guildId });
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🤖 Bot Status: AKTIF')
            .setDescription(`✅ Auto-status bot akan dikirim ke channel ini setiap **5 menit** sekali!\n\n📊 Status akan berisi:\n• Kekayaan (Gems, Coin, DL)\n• HP & kondisi karakter\n• Progress Dungeon\n• Status Farm\n• Info Kota\n\nGunakan \`/bot stop\` untuk menghentikan.`)
            .setTimestamp()],
          ephemeral: false
        });
        return;
      }

      if (sub === 'stop') {
        const guildId = interaction.guildId || '';
        botStatusChannels.delete(guildId);
        await interaction.reply({
          content: '🛑 **Bot auto-status dihentikan!** Tidak ada lagi laporan otomatis.',
          ephemeral: false
        });
        return;
      }

      // Default /bot info
      const { loadMinigameDB, getPlayer } = require('../utils/minigame');
      const db = loadMinigameDB();
      const botName = interaction.client.user?.username || 'ZHU Bot';
      const botId = botName;
      const botPlayer = getPlayer(db, botId);
      const DIFFS = ['Normal', 'Hard', 'Nightmare', 'Hell', 'Torment'];
      const dp = botPlayer.dungeonProgress;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🤖 Status Bot — ${botName}`)
        .addFields(
          { name: '💰 Kekayaan', value: `💎 ${botPlayer.gems.toLocaleString()} Gems\n🔑 ${botPlayer.coins} Coin`, inline: true },
          { name: '❤️ HP', value: `${botPlayer.hp}/${botPlayer.maxHp}`, inline: true },
          { name: '⚔️ Dungeon', value: `${DIFFS[dp?.difficulty ?? 0]} Ch.${dp?.chapter ?? 1} Stage ${dp?.stage ?? 1}`, inline: true },
        )
        .setFooter({ text: 'Gunakan /bot playgame untuk aktivasi auto-status 5 menit' });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const command = commandsMap.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`, 'Interaction');
      return;
    }

    try {
      logger.debug(`User ${interaction.user.tag} ran command /${interaction.commandName}`, 'Interaction');
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing /${interaction.commandName}`, 'Interaction');
      logger.error(error as Error);

      const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
  },
};

export default interactionCreateEvent;
