import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, ClientEvents } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: any) => Promise<void>;
}

export interface BotEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

export interface Warning {
  id: string;
  reason: string;
  moderatorId: string;
  timestamp: number;
}

export interface UserData {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  lastMessageTimestamp: number;
  warnings: Warning[];
  // Economy upgrades
  balance: number;
  lastDailyClaim: number;
}

export interface GuildSettings {
  guildId: string;
  welcomeChannelId?: string;
  defaultRoleId?: string;
  // Advanced features config
  modLogChannelId?: string;
  levelRoles?: Record<string, string>; // Map of level to roleId (e.g. { "5": "role_id_here" })
  // Auto-ad config
  adChannelId?: string;
  adIntervalMinutes?: number;
  adTemplate?: string;
  lastAdPostTimestamp?: number;
}

export interface DatabaseSchema {
  users: Record<string, UserData>; // Key: guildId-userId
  guilds: Record<string, GuildSettings>; // Key: guildId
}
