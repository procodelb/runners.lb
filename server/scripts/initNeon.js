const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Set environment variables directly
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.PG_SSL = 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function ensureSchema() {
  // Create tables if missing using snake_case; align with project needs
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    business_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    instagram TEXT,
    website TEXT,
    google_location TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);`);

  await pool.query(`CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    default_fee_lbp BIGINT DEFAULT 0,
    default_fee_usd NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`CREATE TABLE IF NOT EXISTS price_list (
    id SERIAL PRIMARY KEY,
    country TEXT DEFAULT 'Lebanon',
    area TEXT NOT NULL,
    fees_lbp BIGINT DEFAULT 200000,
    fees_usd NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    lbp_per_usd NUMERIC(18,6) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);

  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_ref TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ecommerce','instant','go_to_market')),
    is_purchase BOOLEAN DEFAULT false,
    customer_phone TEXT,
    customer_name TEXT,
    customer_address TEXT,
    brand_name TEXT,
    voucher_code TEXT,
    deliver_method TEXT CHECK (deliver_method IN ('in_house','third_party')),
    third_party_name TEXT,
    third_party_fee_usd NUMERIC(10,2) DEFAULT 0,
    third_party_fee_lbp BIGINT DEFAULT 0,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    driver_fee_usd NUMERIC(10,2) DEFAULT 0,
    driver_fee_lbp BIGINT DEFAULT 0,
    instant BOOLEAN DEFAULT false,
    notes TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new','assigned','picked_up','in_transit','delivered','completed','cancelled','returned')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
    total_usd NUMERIC(12,2) DEFAULT 0,
    total_lbp BIGINT DEFAULT 0,
    delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
    delivery_fee_lbp BIGINT DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
  );`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);`);

  await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    tx_type TEXT NOT NULL,
    amount_usd NUMERIC(12,2) DEFAULT 0,
    amount_lbp BIGINT DEFAULT 0,
    actor_type TEXT,
    actor_id INTEGER,
    debit_account TEXT,
    credit_account TEXT,
    description TEXT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);`);

  await pool.query(`CREATE TABLE IF NOT EXISTS cashbox (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    balance_usd NUMERIC(12,2) DEFAULT 0,
    balance_lbp BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Seed single cashbox row
  await pool.query(`INSERT INTO cashbox (id, balance_usd, balance_lbp)
    VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING;`);

  // Cashbox entries table (history)
  await pool.query(`CREATE TABLE IF NOT EXISTS cashbox_entries (
    id SERIAL PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in','cash_out','driver_advance','driver_return')),
    amount_usd NUMERIC(12,2) DEFAULT 0,
    amount_lbp BIGINT DEFAULT 0,
    actor_type TEXT,
    actor_id INTEGER,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );`);
}

async function seedMinimal() {
  // Admin user
  const adminEmail = 'runners.leb@gmail.com';
  const adminPass = '123456789';
  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
  if (existing.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query('INSERT INTO users(email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)', [adminEmail, hash, 'Admin', 'admin']);
    console.log('✅ Admin user created');
  } else {
    console.log('✅ Admin user already exists');
  }

  // Exchange rate
  await pool.query(`INSERT INTO exchange_rates(lbp_per_usd)
    VALUES ($1) ON CONFLICT DO NOTHING`, [Number(process.env.EXCHANGE_RATE || 89000)]);
  console.log('✅ Exchange rate initialized');
}

async function main() {
  try {
    console.log('🔧 Initializing Neon PostgreSQL schema...');
    console.log('📡 Connecting to:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    await ensureSchema();
    console.log('✅ Schema created successfully');
    
    await seedMinimal();
    console.log('✅ Neon PostgreSQL schema initialized successfully!');
  } catch (e) {
    console.error('❌ Init error:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
