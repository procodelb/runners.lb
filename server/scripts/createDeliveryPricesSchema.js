const { Pool } = require('pg');
require('dotenv').config();

// Use existing database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function createDeliveryPricesTable() {
  console.log('🚀 Creating delivery_prices table and enhanced accounting schema...');

  try {
    // 1. Create delivery_prices table
    console.log('📋 Creating delivery_prices table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_prices (
        id SERIAL PRIMARY KEY,
        country TEXT NOT NULL DEFAULT 'Lebanon',
        region TEXT NOT NULL,
        sub_region TEXT,
        price_lbp BIGINT NOT NULL DEFAULT 0,
        price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(country, region, sub_region)
      );
    `);

    // 2. Create payments table for accounting
    console.log('📋 Creating payments table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        amount_lbp BIGINT NOT NULL DEFAULT 0,
        amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
        payment_date TIMESTAMPTZ DEFAULT now(),
        description TEXT,
        reference_number TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // 3. Create client_accounts table for balance tracking
    console.log('📋 Creating client_accounts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_accounts (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        old_balance_lbp BIGINT DEFAULT 0,
        old_balance_usd NUMERIC(10,2) DEFAULT 0,
        current_balance_lbp BIGINT DEFAULT 0,
        current_balance_usd NUMERIC(10,2) DEFAULT 0,
        last_updated TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(client_id)
      );
    `);

    // 4. Add delivery location fields to orders table
    console.log('📋 Adding delivery location fields to orders table...');
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_country TEXT DEFAULT 'Lebanon',
      ADD COLUMN IF NOT EXISTS delivery_region TEXT,
      ADD COLUMN IF NOT EXISTS delivery_sub_region TEXT,
      ADD COLUMN IF NOT EXISTS delivery_price_id INTEGER REFERENCES delivery_prices(id) ON DELETE SET NULL;
    `);

    // 5. Create indexes for performance
    console.log('🔍 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_delivery_prices_country_region ON delivery_prices(country, region);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_delivery_prices_active ON delivery_prices(is_active);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_client_accounts_client_id ON client_accounts(client_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_delivery_location ON orders(delivery_country, delivery_region);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_delivery_price_id ON orders(delivery_price_id);');

    console.log('✅ All tables and indexes created successfully');

  } catch (error) {
    console.error('❌ Error creating delivery prices schema:', error);
    throw error;
  }
}

async function seedDeliveryPrices() {
  console.log('🌱 Seeding delivery prices data...');

  try {
    // Check if data already exists
    const { rows: existingPrices } = await pool.query('SELECT COUNT(*) as count FROM delivery_prices');
    if (parseInt(existingPrices[0].count) > 0) {
      console.log('✅ Delivery prices already exist, skipping seed');
      return;
    }

    // Sample delivery prices based on the image example
    const deliveryPrices = [
      // Lebanon regions
      { country: 'Lebanon', region: 'El Koura', sub_region: 'Aaba', price_lbp: 200000, price_usd: 0.0 },
      { country: 'Lebanon', region: 'Beirut', sub_region: null, price_lbp: 200000, price_usd: 2.25 },
      { country: 'Lebanon', region: 'Mount Lebanon', sub_region: null, price_lbp: 250000, price_usd: 2.81 },
      { country: 'Lebanon', region: 'North Lebanon', sub_region: null, price_lbp: 300000, price_usd: 3.37 },
      { country: 'Lebanon', region: 'South Lebanon', sub_region: null, price_lbp: 300000, price_usd: 3.37 },
      { country: 'Lebanon', region: 'Bekaa', sub_region: null, price_lbp: 350000, price_usd: 3.93 },
      { country: 'Lebanon', region: 'Nabatieh', sub_region: null, price_lbp: 350000, price_usd: 3.93 },
      
      // More specific regions
      { country: 'Lebanon', region: 'El Koura', sub_region: 'Kfarhazir', price_lbp: 200000, price_usd: 0.0 },
      { country: 'Lebanon', region: 'El Koura', sub_region: 'Amioun', price_lbp: 200000, price_usd: 0.0 },
      { country: 'Lebanon', region: 'Beirut', sub_region: 'Hamra', price_lbp: 200000, price_usd: 2.25 },
      { country: 'Lebanon', region: 'Beirut', sub_region: 'Verdun', price_lbp: 200000, price_usd: 2.25 },
      { country: 'Lebanon', region: 'Beirut', sub_region: 'Ashrafieh', price_lbp: 200000, price_usd: 2.25 },
    ];

    for (const price of deliveryPrices) {
      await pool.query(`
        INSERT INTO delivery_prices (country, region, sub_region, price_lbp, price_usd, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (country, region, sub_region) DO NOTHING
      `, [price.country, price.region, price.sub_region, price.price_lbp, price.price_usd, true]);
    }

    console.log('✅ Delivery prices seeded successfully');

  } catch (error) {
    console.error('❌ Error seeding delivery prices:', error);
    throw error;
  }
}

async function createBalanceViews() {
  console.log('📊 Creating balance calculation views...');

  try {
    // Create a view for client balances
    await pool.query(`
      CREATE OR REPLACE VIEW client_balances AS
      SELECT 
        c.id as client_id,
        c.business_name,
        c.contact_person,
        c.phone,
        COALESCE(ca.old_balance_lbp, 0) as old_balance_lbp,
        COALESCE(ca.old_balance_usd, 0) as old_balance_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) as pending_orders_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) as pending_orders_usd,
        COALESCE(SUM(p.amount_lbp), 0) as total_payments_lbp,
        COALESCE(SUM(p.amount_usd), 0) as total_payments_usd,
        (COALESCE(ca.old_balance_lbp, 0) + 
         COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) - 
         COALESCE(SUM(p.amount_lbp), 0)) as current_balance_lbp,
        (COALESCE(ca.old_balance_usd, 0) + 
         COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) - 
         COALESCE(SUM(p.amount_usd), 0)) as current_balance_usd
      FROM clients c
      LEFT JOIN client_accounts ca ON c.id = ca.client_id
      LEFT JOIN orders o ON (c.business_name = o.customer_name OR c.id::text = o.customer_name)
      LEFT JOIN payments p ON c.id = p.client_id
      GROUP BY c.id, c.business_name, c.contact_person, c.phone, ca.old_balance_lbp, ca.old_balance_usd;
    `);

    // Create a view for order summaries with delivery prices
    await pool.query(`
      CREATE OR REPLACE VIEW order_summaries AS
      SELECT 
        o.id,
        o.order_ref,
        o.customer_name,
        o.customer_phone,
        o.delivery_country,
        o.delivery_region,
        o.delivery_sub_region,
        dp.price_lbp as delivery_price_lbp,
        dp.price_usd as delivery_price_usd,
        o.total_lbp,
        o.total_usd,
        o.status,
        o.payment_status,
        o.created_at,
        d.full_name as driver_name,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN delivery_prices dp ON o.delivery_price_id = dp.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id;
    `);

    console.log('✅ Balance views created successfully');

  } catch (error) {
    console.error('❌ Error creating balance views:', error);
    throw error;
  }
}

async function verifySchema() {
  console.log('🔍 Verifying new schema...');

  try {
    const tables = ['delivery_prices', 'payments', 'client_accounts'];
    
    for (const table of tables) {
      const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`✅ ${table}: ${rows[0].count} records`);
    }

    // Test delivery prices query
    const { rows: priceTest } = await pool.query(`
      SELECT country, region, sub_region, price_lbp, price_usd 
      FROM delivery_prices 
      WHERE country = 'Lebanon' AND region = 'El Koura' 
      LIMIT 3
    `);
    console.log('✅ Delivery prices test query successful:', priceTest.length, 'results');

    // Test balance view
    const { rows: balanceTest } = await pool.query('SELECT COUNT(*) as count FROM client_balances');
    console.log(`✅ Client balances view: ${balanceTest[0].count} records`);

    console.log('✅ Schema verification completed');

  } catch (error) {
    console.error('❌ Schema verification failed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting delivery prices schema migration...');
    console.log('📡 Connecting to database...');
    
    // Test connection
    await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // Create tables and indexes
    await createDeliveryPricesTable();
    
    // Seed initial data
    await seedDeliveryPrices();
    
    // Create views
    await createBalanceViews();
    
    // Verify everything works
    await verifySchema();
    
    console.log('🎉 Delivery prices schema migration completed successfully!');
    console.log('📊 System ready for delivery price integration');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { createDeliveryPricesTable, seedDeliveryPrices, createBalanceViews };
