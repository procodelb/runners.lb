#!/usr/bin/env node
/*
  Dev-only migration to ensure required columns exist on orders table.
  Safeguards:
  - Aborts if NODE_ENV === 'production'
  - Prints SQL to stdout if production
*/

const { query } = require('../config/database');

const MIGRATION_SQL = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS computed_total_usd numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS computed_total_lbp numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS moved_to_history boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
`;

async function main() {
  const env = String(process.env.NODE_ENV || 'development').toLowerCase();
  if (env === 'production') {
    console.log('Refusing to run in production. Apply the following SQL manually:\n');
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  console.log('Ensuring required columns exist on orders...');
  const statements = MIGRATION_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await query(stmt);
      console.log('Applied:', stmt);
    } catch (err) {
      console.warn('Warning executing statement:', stmt, '\n', err.message);
    }
  }
  console.log('Done.');
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});


