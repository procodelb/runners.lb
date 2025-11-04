const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

function main() {
  const env = { ...process.env, NODE_ENV: 'development', USE_SQLITE: 'false', DATABASE_URL };
  const serverDir = path.join(process.cwd(), 'server');
  const entry = path.join(serverDir, 'index.js');
  console.log('Starting server with Neon Postgres...');
  console.log('DATABASE_URL:', DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
  const child = spawn(process.execPath, [entry], { cwd: serverDir, env, stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log('Server process exited with code', code);
  });
}

main();


