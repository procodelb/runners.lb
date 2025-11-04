#!/usr/bin/env node
/*
  Dev-only Neon/Postgres migration runner with safety guards.
  - If NODE_ENV === 'production': print SQL and exit non-zero.
  - Requires DATABASE_URL. Attempts pg_dump backup before applying.
  - If pg_dump not available or backup fails: abort.
*/

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const SQL = `
BEGIN;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS computed_total_usd numeric DEFAULT 0;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS computed_total_lbp numeric DEFAULT 0;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS moved_to_history boolean DEFAULT false;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS accounting_cashed boolean DEFAULT false;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE TABLE IF NOT EXISTS cashbox_entries (
  id serial PRIMARY KEY,
  order_id integer,
  amount_usd numeric DEFAULT 0,
  amount_lbp numeric DEFAULT 0,
  mode text,
  note text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cashbox_reservations (
  id serial PRIMARY KEY,
  order_id integer,
  amount_usd numeric DEFAULT 0,
  amount_lbp numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  released_at timestamptz NULL
);
COMMIT;`;

function mask(url) {
  try { return String(url).replace(/\/\/.*@/, '//***:***@'); } catch { return 'hidden'; }
}

function main() {
  if (!DB_URL) {
    console.error('❌ DATABASE_URL/POSTGRES_URL not set. Aborting.');
    process.exit(1);
  }

  if (NODE_ENV === 'production') {
    console.log('🚫 NODE_ENV=production — will not run migrations automatically.');
    console.log('🔽 Please apply the following SQL manually:');
    console.log(SQL);
    process.exit(2);
  }

  // Backup using pg_dump
  console.log('🧬 Attempting pg_dump backup before migrations...');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(require('os').tmpdir(), `neon-backup-${ts}.sql`);
  const dump = spawnSync('pg_dump', ['--no-owner', '--no-privileges', '--format=plain', '--file', outFile, DB_URL], { stdio: 'inherit' });
  if (dump.status !== 0) {
    console.error('❌ pg_dump failed or not available. Aborting migrations.');
    console.log('ℹ️ Migration SQL (not applied):');
    console.log(SQL);
    process.exit(3);
  }
  console.log('✅ Backup written to', outFile);

  // Apply SQL using psql
  console.log('🚀 Applying migrations to', mask(DB_URL));
  const tmpSql = path.join(require('os').tmpdir(), `neon-migration-${ts}.sql`);
  fs.writeFileSync(tmpSql, SQL, 'utf8');
  const psql = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', DB_URL, '-f', tmpSql], { stdio: 'inherit' });
  if (psql.status !== 0) {
    console.error('❌ Migration failed. Backup is available at', outFile);
    process.exit(4);
  }
  console.log('✅ Migration applied successfully.');
}

main();


