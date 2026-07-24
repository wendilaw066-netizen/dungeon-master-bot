import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSchema, UserData, GuildSettings, Warning } from './types';
import { logger } from './logger';

const DB_PATH = path.join(process.cwd(), 'database.json');

class Database {
  private data: DatabaseSchema = {
    users: {},
    guilds: {},
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        logger.info('Database loaded successfully.', 'DB');
      } else {
        this.save();
        logger.info('Created new database.json file.', 'DB');
      }
    } catch (error) {
      logger.error('Failed to load database. Using memory fallback.', 'DB');
      logger.error(error as Error);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save database to disk.', 'DB');
      logger.error(error as Error);
    }
  }

  // User Management
  getUser(guildId: string, userId: string): UserData {
    const key = `${guildId}-${userId}`;
    if (!this.data.users[key]) {
      this.data.users[key] = {
        userId,
        guildId,
        xp: 0,
        level: 1,
        lastMessageTimestamp: 0,
        warnings: [],
        balance: 0,
        lastDailyClaim: 0,
      };
      this.save();
    }
    // Backward compatibility check for existing DB items
    const user = this.data.users[key];
    let changed = false;
    if (user.balance === undefined) { user.balance = 0; changed = true; }
    if (user.lastDailyClaim === undefined) { user.lastDailyClaim = 0; changed = true; }
    if (changed) this.save();

    return user;
  }

  updateUser(guildId: string, userId: string, update: Partial<Omit<UserData, 'userId' | 'guildId'>>): UserData {
    const user = this.getUser(guildId, userId);
    this.data.users[`${guildId}-${userId}`] = {
      ...user,
      ...update,
    };
    this.save();
    return this.data.users[`${guildId}-${userId}`];
  }

  getTopUsers(guildId: string, limit = 10): UserData[] {
    return Object.values(this.data.users)
      .filter((user) => user.guildId === guildId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  // Warnings
  addWarning(guildId: string, userId: string, reason: string, moderatorId: string): Warning {
    const user = this.getUser(guildId, userId);
    const warning: Warning = {
      id: Math.random().toString(36).substring(2, 9),
      reason,
      moderatorId,
      timestamp: Date.now(),
    };
    user.warnings.push(warning);
    this.save();
    return warning;
  }

  getWarnings(guildId: string, userId: string): Warning[] {
    return this.getUser(guildId, userId).warnings;
  }

  clearWarnings(guildId: string, userId: string): void {
    const user = this.getUser(guildId, userId);
    user.warnings = [];
    this.save();
  }

  // Economy Helper Methods
  addBalance(guildId: string, userId: string, amount: number): UserData {
    const user = this.getUser(guildId, userId);
    user.balance += amount;
    this.save();
    return user;
  }

  deductBalance(guildId: string, userId: string, amount: number): UserData {
    const user = this.getUser(guildId, userId);
    user.balance = Math.max(0, user.balance - amount);
    this.save();
    return user;
  }

  // Guild Settings
  getGuildSettings(guildId: string): GuildSettings {
    if (!this.data.guilds[guildId]) {
      this.data.guilds[guildId] = {
        guildId,
        levelRoles: {},
      };
      this.save();
    }
    // Backward compatibility checks
    const settings = this.data.guilds[guildId];
    let changed = false;
    if (!settings.levelRoles) { settings.levelRoles = {}; changed = true; }
    if (changed) this.save();

    return settings;
  }

  updateGuildSettings(guildId: string, update: Partial<Omit<GuildSettings, 'guildId'>>): GuildSettings {
    const settings = this.getGuildSettings(guildId);
    this.data.guilds[guildId] = {
      ...settings,
      ...update,
    };
    this.save();
    return this.data.guilds[guildId];
  }

  // Level role rewards helpers
  setLevelRole(guildId: string, level: number, roleId: string): GuildSettings {
    const settings = this.getGuildSettings(guildId);
    if (!settings.levelRoles) settings.levelRoles = {};
    settings.levelRoles[level.toString()] = roleId;
    this.save();
    return settings;
  }

  removeLevelRole(guildId: string, level: number): GuildSettings {
    const settings = this.getGuildSettings(guildId);
    if (settings.levelRoles && settings.levelRoles[level.toString()]) {
      delete settings.levelRoles[level.toString()];
      this.save();
    }
    return settings;
  }

  // Retrieve all guilds for backgrounds scheduler
  getAllGuilds(): GuildSettings[] {
    return Object.values(this.data.guilds);
  }
}

export const db = new Database();
