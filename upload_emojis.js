require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const GUILD_ID = '1419848896762613921';
const EMOJIS_DIR = path.join(__dirname, 'generated_emojis');
const EMOJIS_TS_PATH = path.join(__dirname, 'src/utils/rpg/emojis.ts');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('Guild not found!');
      process.exit(1);
    }
    
    console.log(`Uploading to guild: ${guild.name}`);
    const existingEmojis = await guild.emojis.fetch();
    
    if (!fs.existsSync(EMOJIS_DIR)) {
      console.log('No generated_emojis directory found.');
      process.exit(0);
    }
    
    const files = fs.readdirSync(EMOJIS_DIR).filter(f => f.endsWith('.png') && !f.includes('_raw'));
    let tsContent = fs.readFileSync(EMOJIS_TS_PATH, 'utf-8');
    let updatedCount = 0;
    
    for (const file of files) {
      // Filename convention: key.png
      const key = file.replace('.png', '');
      const emojiName = key.length > 32 ? key.substring(0, 32) : key;
      const filePath = path.join(EMOJIS_DIR, file);
      
      // Check if emoji with same name already exists in guild
      const existing = existingEmojis.find(e => e.name === emojiName);
      let emojiId = '';
      let emojiString = '';
      
      if (existing) {
        console.log(`Emoji ${emojiName} already exists on Discord. Utilizing existing.`);
        emojiId = existing.id;
        emojiString = `<:${existing.name}:${existing.id}>`;
      } else {
        console.log(`Uploading ${emojiName}...`);
        try {
          const newEmoji = await guild.emojis.create({ attachment: filePath, name: emojiName });
          emojiId = newEmoji.id;
          emojiString = `<:${newEmoji.name}:${newEmoji.id}>`;
          console.log(`Uploaded! ID: ${emojiId}`);
        } catch (e) {
          console.error(`Failed to upload ${emojiName}:`, e.message);
          continue;
        }
      }
      
      // Replace the placeholder in emojis.ts
      // Looking for: res_coin: '🪙',  or  res_coin: '<:res_coin:123>',
      // Regex approach: find the key, and replace its string value.
      const regex = new RegExp(`(${key}:\\s*)['"\`].*?['"\`]`, 'g');
      if (regex.test(tsContent)) {
        tsContent = tsContent.replace(regex, `$1'${emojiString}'`);
        updatedCount++;
      } else {
         console.log(`Key ${key} not found in emojis.ts`);
      }
    }
    
    if (updatedCount > 0) {
      fs.writeFileSync(EMOJIS_TS_PATH, tsContent, 'utf-8');
      console.log(`Successfully updated emojis.ts with ${updatedCount} Discord Emoji IDs!`);
    } else {
      console.log('No updates made to emojis.ts.');
    }
    
  } catch (error) {
    console.error('Error during upload process:', error);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
