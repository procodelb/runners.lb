const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Set environment variables directly for Neon
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

async function createCompleteSchema() {
  console.log('🔧 Creating complete Soufiam ERP schema for Neon PostgreSQL...');

  // 1. USERS TABLE
  console.log('📋 Creating users table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      language TEXT DEFAULT 'en',
      theme TEXT DEFAULT 'light',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 2. CLIENTS TABLE (CRM)
  console.log('📋 Creating clients table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
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
    );
  `);

  // 3. DRIVERS TABLE
  console.log('📋 Creating drivers table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drivers (
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
    );
  `);

  // 4. PRICE_LIST TABLE
  console.log('📋 Creating price_list table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_list (
      id SERIAL PRIMARY KEY,
      country TEXT DEFAULT 'Lebanon',
      area TEXT NOT NULL,
      fees_lbp BIGINT DEFAULT 200000,
      fees_usd NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 5. EXCHANGE_RATES TABLE
  console.log('📋 Creating exchange_rates table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id SERIAL PRIMARY KEY,
      lbp_per_usd NUMERIC(18,6) NOT NULL,
      effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 6. ORDERS TABLE
  console.log('📋 Creating orders table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
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
    );
  `);

  // 7. TRANSACTIONS TABLE
  console.log('📋 Creating transactions table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
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
    );
  `);

  // 8. CASHBOX TABLE (Snapshot)
  console.log('📋 Creating cashbox table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashbox (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      balance_usd NUMERIC(12,2) DEFAULT 0,
      balance_lbp BIGINT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 9. CASHBOX_ENTRIES TABLE (History)
  console.log('📋 Creating cashbox_entries table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashbox_entries (
      id SERIAL PRIMARY KEY,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in','cash_out','driver_advance','driver_return')),
      amount_usd NUMERIC(12,2) DEFAULT 0,
      amount_lbp BIGINT DEFAULT 0,
      actor_type TEXT,
      actor_id INTEGER,
      description TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log('✅ All tables created successfully');
}

async function createIndexes() {
  console.log('🔍 Creating indexes for optimal performance...');

  // Clients indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);');

  // Drivers indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_drivers_active ON drivers(active);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);');

  // Orders indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON orders(order_ref);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);');

  // Transactions indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(actor_type, actor_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);');

  // Cashbox entries indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cashbox_entries_type ON cashbox_entries(entry_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cashbox_entries_created_at ON cashbox_entries(created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cashbox_entries_actor ON cashbox_entries(actor_type, actor_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cashbox_entries_created_by ON cashbox_entries(created_by);');

  // Price list indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_price_list_country_area ON price_list(country, area);');

  // Exchange rates indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_at ON exchange_rates(effective_at);');

  // Users indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);');

  console.log('✅ All indexes created successfully');
}

async function seedInitialData() {
  console.log('🌱 Seeding initial data...');

  // 1. Admin user
  const adminEmail = 'runners.leb@gmail.com';
  const adminPass = '123456789';
  const { rows: existingUser } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  
  if (existingUser.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query(
      'INSERT INTO users(email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
      [adminEmail, hash, 'Admin', 'admin']
    );
    console.log('✅ Admin user created');
  } else {
    console.log('✅ Admin user already exists');
  }

  // 2. Exchange rate
  const { rows: existingRate } = await pool.query('SELECT id FROM exchange_rates LIMIT 1');
  if (existingRate.length === 0) {
    await pool.query(
      'INSERT INTO exchange_rates(lbp_per_usd) VALUES ($1)',
      [Number(process.env.EXCHANGE_RATE || 89000)]
    );
    console.log('✅ Exchange rate initialized');
  } else {
    console.log('✅ Exchange rate already exists');
  }

  // 3. Cashbox initial balance
  const { rows: existingCashbox } = await pool.query('SELECT id FROM cashbox WHERE id = 1');
  if (existingCashbox.length === 0) {
    await pool.query(
      'INSERT INTO cashbox(id, balance_usd, balance_lbp) VALUES (1, 0, 0)'
    );
    console.log('✅ Cashbox initialized');
  } else {
    console.log('✅ Cashbox already exists');
  }

  // 4. Default price list entries
  const { rows: existingPrices } = await pool.query('SELECT id FROM price_list LIMIT 1');
  if (existingPrices.length === 0) {
    const defaultAreas = [
      { area: 'Beirut', fees_lbp: 200000, fees_usd: 2.25 },
      { area: 'Mount Lebanon', fees_lbp: 250000, fees_usd: 2.81 },
      { area: 'North Lebanon', fees_lbp: 300000, fees_usd: 3.37 },
      { area: 'South Lebanon', fees_lbp: 300000, fees_usd: 3.37 },
      { area: 'Bekaa', fees_lbp: 350000, fees_usd: 3.93 },
      { area: 'Nabatieh', fees_lbp: 350000, fees_usd: 3.93 }
    ];

    for (const price of defaultAreas) {
      await pool.query(
        'INSERT INTO price_list(country, area, fees_lbp, fees_usd) VALUES ($1, $2, $3, $4)',
        ['Lebanon', price.area, price.fees_lbp, price.fees_usd]
      );
    }
    console.log('✅ Default price list created');
  } else {
    console.log('✅ Price list already exists');
  }

  console.log('✅ Initial data seeded successfully');
}

async function verifySchema() {
  console.log('🔍 Verifying schema integrity...');

  const tables = [
    'users', 'clients', 'drivers', 'price_list', 'exchange_rates',
    'orders', 'transactions', 'cashbox', 'cashbox_entries'
  ];

  for (const table of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`✅ ${table}: ${rows[0].count} records`);
  }

  // Test foreign key relationships
  console.log('🔗 Testing foreign key relationships...');
  
  // Test orders -> drivers relationship
  try {
    await pool.query(`
      SELECT o.id, d.full_name 
      FROM orders o 
      LEFT JOIN drivers d ON o.driver_id = d.id 
      LIMIT 1
    `);
    console.log('✅ Orders -> Drivers relationship: OK');
  } catch (error) {
    console.log('❌ Orders -> Drivers relationship: FAILED');
  }

  // Test orders -> users relationship
  try {
    await pool.query(`
      SELECT o.id, u.full_name 
      FROM orders o 
      LEFT JOIN users u ON o.created_by = u.id 
      LIMIT 1
    `);
    console.log('✅ Orders -> Users relationship: OK');
  } catch (error) {
    console.log('❌ Orders -> Users relationship: FAILED');
  }

  // Test transactions -> orders relationship
  try {
    await pool.query(`
      SELECT t.id, o.order_ref 
      FROM transactions t 
      LEFT JOIN orders o ON t.order_id = o.id 
      LIMIT 1
    `);
    console.log('✅ Transactions -> Orders relationship: OK');
  } catch (error) {
    console.log('❌ Transactions -> Orders relationship: FAILED');
  }

  console.log('✅ Schema verification completed');
}

async function main() {
  try {
    console.log('🚀 Starting complete Neon PostgreSQL schema migration...');
    console.log('📡 Connecting to:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    // Test connection
    await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // Create complete schema
    await createCompleteSchema();
    
    // Create indexes
    await createIndexes();
    
    // Seed initial data
    await seedInitialData();
    
    // Verify schema
    await verifySchema();
    
    console.log('🎉 Complete Neon PostgreSQL schema migration successful!');
    console.log('📊 Database is ready for Soufiam ERP operations');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the migration
main();
