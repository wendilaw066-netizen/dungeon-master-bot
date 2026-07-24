# Premium TypeScript Discord Bot

A modular, feature-rich Discord bot built using **Node.js**, **TypeScript**, and **discord.js v14**.

## ✨ Features

- 🏆 **Leveling / XP System**: Users gain XP by chatting (cooldown protected). Custom `/rank` cards and `/leaderboard` displays.
- ⚙️ **Slash Commands**: Uses Discord's modern `/` command structure.
- 👋 **Welcome System**: Automatically welcomes new members with a beautiful embed in a `#welcome` (or configured) channel.
- 🛡️ **Moderation Tools**: Moderation suite containing `/warn`, `/warnings`, `/kick`, and `/ban` commands.
- 🎲 **Fun & Utility**: Utility commands (`/ping`, `/serverinfo`, `/userinfo`) and interactive commands (`/coinflip`, `/roll`).
- 💾 **Local Database**: Local JSON storage (`database.json`) for persistence with zero external database dependencies.
- 🎨 **Premium Logging**: Color-coded CLI logger to monitor events, errors, and joins.

---

## 🚀 Setup & Installation

### Prerequisite: Enable Gateway Intents
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Choose your application, click **Bot** on the left menu.
3. Scroll down to **Privileged Gateway Intents** and enable:
   - **Server Members Intent** (For welcomes, roles, and ranks)
   - **Message Content Intent** (For XP generation)

### 1. Configuration
Create a `.env` file in the root of the project by copying `.env.example`:
```bash
cp .env.example .env
```
Open `.env` and fill in the values:
- `DISCORD_TOKEN`: Your bot token from the Developer Portal.
- `CLIENT_ID`: `1527910579443073136` (Your application client ID).
- `GUILD_ID`: (Optional) Your Discord Server ID. If provided, slash commands will deploy **instantly** to this server for testing. If left blank, they will deploy globally (which can take up to an hour).
- `WELCOME_CHANNEL_ID`: (Optional) The channel ID where welcomes are sent. If blank, the bot automatically looks for a channel named `welcome` or `general`.
- `DEFAULT_ROLE_ID`: (Optional) Role ID to assign to new members upon joining.

### 2. Deploy Slash Commands
Before running the bot, you must register its commands with Discord:
```bash
npm run register-commands
```

### 3. Run the Bot
- **Development Mode** (auto-restart on save):
  ```bash
  npm run dev
  ```
- **Production Mode** (compile and run):
  ```bash
  npm run build
  npm start
  ```

---

## 🛠️ Slash Commands

| Command | Description | Permissions Required |
|---------|-------------|----------------------|
| `/ping` | Displays bot and API latency | Everyone |
| `/serverinfo` | Displays detailed guild information | Everyone |
| `/userinfo [user]` | Displays profile and role details of a user | Everyone |
| `/coinflip` | Flips a coin (Heads/Tails) | Everyone |
| `/roll [sides] [amount]` | Rolls dice (e.g. rolls 2d20) | Everyone |
| `/rank [user]` | Shows current level, XP, and a custom progress bar | Everyone |
| `/leaderboard` | Shows the top 10 most active members by level | Everyone |
| `/warn <user> <reason>` | Warns a member and saves warning to DB | Kick Members |
| `/warnings <user>` | Lists a member's active warnings | Kick Members |
| `/kick <user> [reason]` | Kicks a member from the server | Kick Members |
| `/ban <user> [reason]` | Bans a member from the server | Ban Members |
