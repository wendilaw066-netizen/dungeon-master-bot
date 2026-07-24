import * as fs from 'fs';
import * as path from 'path';

const zipPath = path.join(process.cwd(), 'Discloud_App.zip');
const apiToken = process.env.DISCLOUD_TOKEN || process.argv[2];

if (!apiToken) {
  console.log('\n⚠️ DisCloud API Token required!');
  console.log('Ambil API Token Anda dari https://discloudbot.com/ (Settings -> API Token)\n');
  process.exit(1);
}

console.log('🚀 Uploading DungeonMaster_Deploy.zip to DisCloud API...');

async function uploadToDiscloud() {
  try {
    const fileData = fs.readFileSync(zipPath);
    const blob = new Blob([fileData], { type: 'application/zip' });
    const formData = new FormData();
    formData.append('file', blob, 'DungeonMaster_Deploy.zip');

    const response = await fetch('https://api.discloud.app/v2/upload', {
      method: 'POST',
      headers: {
        'api-token': apiToken
      },
      body: formData
    });

    const result = await response.json();
    console.log('DisCloud API Response:', result);
    if (result.status === 'ok') {
      console.log('✅ Upload Successful! App is now live on DisCloud!');
    }
  } catch (err: any) {
    console.error('❌ Upload failed:', err.message || err);
  }
}

uploadToDiscloud();
