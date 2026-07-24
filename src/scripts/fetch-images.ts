import fs from 'fs';
import path from 'path';

const ITEMS_PATH = path.join(process.cwd(), 'growtopia-items.json');

async function fetchImages() {
  console.log('Reading database...');
  if (!fs.existsSync(ITEMS_PATH)) {
    console.error('Database not found!');
    return;
  }

  const itemsDb = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
  const allKeys = Object.keys(itemsDb);
  
  // Filter items that don't have an image yet
  const keysToFetch = allKeys.filter(k => !itemsDb[k].image);
  console.log(`Found ${keysToFetch.length} items to fetch images for.`);

  if (keysToFetch.length === 0) {
    console.log('All items already have images.');
    return;
  }

  const BATCH_SIZE = 50;
  let updatedCount = 0;

  for (let i = 0; i < keysToFetch.length; i += BATCH_SIZE) {
    const batchKeys = keysToFetch.slice(i, i + BATCH_SIZE);
    
    // Convert item names to Wiki File titles (e.g. "Dirt" -> "File:Dirt.png")
    // Note: Items might have special characters or spaces. MediaWiki handles spaces as underscores or handles spaces directly.
    const titles = batchKeys.map(k => `File:${itemsDb[k].item}.png`);
    const titlesParam = titles.map(encodeURIComponent).join('|');

    const url = `https://growtopia.fandom.com/api.php?action=query&titles=${titlesParam}&prop=imageinfo&iiprop=url&format=json&origin=*`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data = await res.json();
      const pages = data.query?.pages || {};

      for (const pid of Object.keys(pages)) {
        if (pid === '-1') continue; // Missing page
        const page = pages[pid];
        const imageUrl = page.imageinfo?.[0]?.url;
        if (imageUrl) {
          // Find which key this belongs to
          // page.title is like "File:Dirt.png"
          const rawItemName = page.title.replace(/^File:/i, '').replace(/\.png$/i, '');
          const matchKey = Object.keys(itemsDb).find(
            k => itemsDb[k].item.toLowerCase() === rawItemName.toLowerCase().replace(/_/g, ' ')
          );

          if (matchKey) {
            // Fandom's static.wikia.nocookie.net often includes a /revision/latest?cb=... suffix which is fine.
            // But we can clean it to just the base URL if needed. Let's keep it as is.
            itemsDb[matchKey].image = imageUrl.split('/revision/latest')[0];
            updatedCount++;
          }
        }
      }

      console.log(`Progress: ${Math.min(i + BATCH_SIZE, keysToFetch.length)} / ${keysToFetch.length} (Updated: ${updatedCount})`);

      // Save every few batches
      if (i % (BATCH_SIZE * 5) === 0) {
        fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
      }

      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`Error fetching batch ${i}:`, e);
    }
  }

  // Final save
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsDb, null, 2), 'utf-8');
  console.log(`\n✅ Done! Successfully found and saved ${updatedCount} images.`);
}

fetchImages();
