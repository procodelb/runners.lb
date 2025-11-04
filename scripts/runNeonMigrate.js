const { spawnSync } = require('child_process');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

function main() {
  const env = { ...process.env, NODE_ENV: 'development', DATABASE_URL };
  const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'neonDevMigrate.js');
  console.log('Running Neon dev migration with env DATABASE_URL (masked)...');
  console.log(DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
  const r = spawnSync(process.execPath, [scriptPath], { env, stdio: 'inherit' });
  process.exit(r.status || 0);
}

main();


