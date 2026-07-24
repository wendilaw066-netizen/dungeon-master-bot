import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const mode = process.argv[2] || 'save';

console.log(`\n🔄 [Git Sync Engine] Executing mode: ${mode.toUpperCase()}...\n`);

try {
  if (mode === 'save' || mode === 'push') {
    console.log('📦 Staging files...');
    try {
      execSync('git add .', { stdio: 'inherit' });
      execSync('git commit -m "Auto-sync from Antigravity update"', { stdio: 'inherit' });
    } catch (e) {
      console.log('ℹ️ No changes to commit.');
    }
    console.log('🚀 Pushing to GitHub remote...');
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('\n✅ Successfully pushed all changes to GitHub! You can now pull on any computer.\n');
  } else if (mode === 'pull' || mode === 'sync') {
    console.log('📥 Fetching latest changes from GitHub...');
    execSync('git pull origin main --rebase', { stdio: 'inherit' });
    console.log('🔨 Building updated TypeScript code...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('🔄 Hot-reloading live bot...');
    execSync('npx pm2 reload dungeon-master', { stdio: 'inherit' });
    console.log('\n✅ Successfully updated to latest version! Bot is live with latest changes.\n');
  }
} catch (error: any) {
  console.error('\n⚠️ Sync Notice: Git command executed. Ensure git remote is connected.\n', error.message || error);
}
