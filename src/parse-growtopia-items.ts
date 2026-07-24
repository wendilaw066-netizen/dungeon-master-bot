import * as fs from 'fs';
import * as path from 'path';

const SRC_PATH = path.join(
  'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fbcee999-6be0-4d43-b9c4-906c78ef1c14\\.system_generated\\steps\\624\\content.md'
);
const DEST_PATH = path.join(process.cwd(), 'growtopia-items.json');

function parseItems() {
  if (!fs.existsSync(SRC_PATH)) {
    console.error('Source file not found at:', SRC_PATH);
    return;
  }

  const content = fs.readFileSync(SRC_PATH, 'utf-8');
  const lines = content.split('\n');

  const itemsDb: { [key: string]: { item: string; description: string } } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line is a comment naming the item
    if (line.startsWith('//') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      
      // Verify next line contains the ID and description split by '|'
      if (nextLine.includes('|')) {
        const itemName = line.replace(/^\/\/\s*/, '').trim();
        
        // Skip generic comments like "// Blank" or "// UPDATE_STORE"
        if (itemName.toLowerCase() === 'blank' || itemName.toUpperCase() === 'UPDATE_STORE') {
          continue;
        }

        const pipeIndex = nextLine.indexOf('|');
        const description = nextLine.substring(pipeIndex + 1).trim();

        if (itemName && description) {
          const key = itemName.toLowerCase();
          itemsDb[key] = {
            item: itemName,
            description: description
          };
        }
      }
    }
  }

  fs.writeFileSync(DEST_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
  console.log(`Successfully parsed and saved ${Object.keys(itemsDb).length} Growtopia items to growtopia-items.json`);
}

parseItems();
