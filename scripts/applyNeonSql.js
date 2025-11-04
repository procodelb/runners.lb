const { Pool } = require('pg');

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

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  console.log('Applying migrations to', url.replace(/\/\/.*@/, '//***:***@'));
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('Migration applied successfully');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(2);
  } finally {
    client.release();
    await pool.end();
  }
}

main();


