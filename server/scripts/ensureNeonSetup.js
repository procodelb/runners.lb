const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Neon database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function ensureAllTables() {
  console.log('🔧 Ensuring all required tables exist in Neon...');

  // Users table
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

  // Clients table
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

  // Drivers table
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

  // Price list table
  await pool.query(`CREATE TABLE IF NOT EXISTS price_list (
    id SERIAL PRIMARY KEY,
    country TEXT DEFAULT 'Lebanon',
    area TEXT NOT NULL,
    fees_lbp BIGINT DEFAULT 200000,
    fees_usd NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Exchange rates table
  await pool.query(`CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    lbp_per_usd NUMERIC(18,6) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);

  // Delivery prices table (used for location-based fees)
  await pool.query(`CREATE TABLE IF NOT EXISTS delivery_prices (
    id SERIAL PRIMARY KEY,
    country TEXT DEFAULT 'Lebanon',
    region TEXT NOT NULL,
    sub_region TEXT,
    price_lbp BIGINT DEFAULT 0,
    price_usd NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_delivery_prices_region ON delivery_prices(country, region, COALESCE(sub_region,'~'));
    CREATE INDEX IF NOT EXISTS idx_delivery_prices_active ON delivery_prices(is_active);
  `);

  // Third parties table
  await pool.query(`CREATE TABLE IF NOT EXISTS third_parties (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    contact_phone TEXT,
    email TEXT,
    commission_rate NUMERIC(5,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Orders table
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

  // Ensure additional order fields exist (non-destructive migrations)
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepaid_status BOOLEAN DEFAULT false;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS third_party_id INTEGER REFERENCES third_parties(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'direct';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_usd NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_lbp BIGINT DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_country TEXT DEFAULT 'Lebanon';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_region TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_sub_region TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price_id INTEGER REFERENCES delivery_prices(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_text TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id TEXT;
  `);

  // Transactions table
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
    category TEXT,
    direction TEXT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Order history / audit table
  await pool.query(`CREATE TABLE IF NOT EXISTS order_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Cashbox table
  await pool.query(`CREATE TABLE IF NOT EXISTS cashbox (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    balance_usd NUMERIC(12,2) DEFAULT 0,
    balance_lbp BIGINT DEFAULT 0,
    initial_balance_usd NUMERIC(12,2) DEFAULT 0,
    initial_balance_lbp BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);

  // Cashbox entries table
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

  // Cashbox assignments per driver per date
  await pool.query(`CREATE TABLE IF NOT EXISTS cashbox_assignments (
    id SERIAL PRIMARY KEY,
    assign_date DATE NOT NULL DEFAULT CURRENT_DATE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
    assigned_usd NUMERIC(12,2) DEFAULT 0,
    assigned_lbp BIGINT DEFAULT 0,
    returned_usd NUMERIC(12,2) DEFAULT 0,
    returned_lbp BIGINT DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assign_date, driver_id)
  );`);

  // Create indexes for better performance
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, created_at);
  `);

  console.log('✅ All tables and indexes created successfully');
}

async function seedInitialData() {
  console.log('🔧 Seeding initial data...');

  // Ensure admin user exists
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

  // Ensure cashbox record exists
  await pool.query(`INSERT INTO cashbox (id, balance_usd, balance_lbp)
    VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING;`);
  console.log('✅ Cashbox initialized');

  // Ensure exchange rate exists
  await pool.query(`
    INSERT INTO exchange_rates(lbp_per_usd)
    SELECT $1
    WHERE NOT EXISTS (SELECT 1 FROM exchange_rates)
  `, [Number(process.env.EXCHANGE_RATE || 89000)]);
  console.log('✅ Exchange rate initialized');

  // Seed delivery prices if table exists and empty (minimal seed)
  await pool.query(`
    INSERT INTO delivery_prices(country, region, sub_region, price_lbp, price_usd, is_active)
    SELECT 'Lebanon','Beirut',NULL, 200000, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM delivery_prices)
  `);
  console.log('✅ Delivery prices seeded (minimal)');
}

async function verifyConnection() {
  try {
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Neon database connection verified:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Neon database connection failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🔧 Setting up Neon PostgreSQL for Soufian ERP...');
    console.log('📡 Database URL:', DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    // Test connection first
    const connected = await verifyConnection();
    if (!connected) {
      throw new Error('Cannot connect to Neon database');
    }

    // Ensure all tables exist
    await ensureAllTables();
    
    // Seed initial data
    await seedInitialData();
    
    console.log('✅ Neon PostgreSQL setup completed successfully!');
    console.log('🚀 All REST endpoints will now use Neon database');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
