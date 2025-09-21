require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Starting ERP System Migration...');
  
  try {
    // 1. Add missing fields to orders table
    console.log('📋 Adding missing fields to orders table...');
    
    // Add prepaid_status field
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS prepaid_status TEXT DEFAULT 'unpaid' 
      CHECK (prepaid_status IN ('unpaid', 'partial', 'paid', 'prepaid', 'refunded'))
    `);
    
    // Add third_party_id field
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS third_party_id INTEGER
    `);
    
    // Add location fields for Google Maps
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS location_text TEXT
    `);
    
    // Add delivery_mode field
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'direct'
    `);
    
    // Update payment_status to include prepaid
    await pool.query(`
      ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_payment_status_check
    `);
    
    await pool.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'prepaid', 'refunded'))
    `);

    // 2. Create/Update transactions table with proper structure
    console.log('📋 Creating/updating transactions table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        tx_type TEXT NOT NULL,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
        category TEXT NOT NULL,
        actor_type TEXT,
        actor_id INTEGER,
        description TEXT,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    // Add missing columns to transactions if they don't exist
    await pool.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('credit', 'debit')),
      ADD COLUMN IF NOT EXISTS category TEXT
    `);

    // 3. Create/Update cashbox table
    console.log('📋 Creating/updating cashbox table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cashbox (
        id INTEGER PRIMARY KEY DEFAULT 1,
        balance_usd NUMERIC(12,2) DEFAULT 0,
        balance_lbp BIGINT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT single_cashbox CHECK (id = 1)
      )
    `);
    
    // Insert initial cashbox record if it doesn't exist
    await pool.query(`
      INSERT INTO cashbox (id, balance_usd, balance_lbp) 
      VALUES (1, 0, 0) 
      ON CONFLICT (id) DO NOTHING
    `);

    // 4. Create exchange_rates table
    console.log('📋 Creating exchange_rates table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        lbp_per_usd NUMERIC(18,6) NOT NULL,
        effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    
    // Insert default exchange rate if none exists
    await pool.query(`
      INSERT INTO exchange_rates (lbp_per_usd) 
      SELECT 89000 
      WHERE NOT EXISTS (SELECT 1 FROM exchange_rates)
    `);

    // 5. Create/Update clients table with proper structure
    console.log('📋 Creating/updating clients table...');
    
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
        old_balance_usd NUMERIC(12,2) DEFAULT 0,
        old_balance_lbp BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    // Add missing columns to clients if they don't exist
    await pool.query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS old_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS old_balance_lbp BIGINT DEFAULT 0
    `);

    // 6. Create/Update drivers table with proper structure
    console.log('📋 Creating/updating drivers table...');
    
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
      )
    `);

    // 7. Create delivery_prices table
    console.log('📋 Creating delivery_prices table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_prices (
        id SERIAL PRIMARY KEY,
        country TEXT DEFAULT 'Lebanon',
        region TEXT NOT NULL,
        sub_region TEXT,
        price_lbp BIGINT DEFAULT 0,
        price_usd NUMERIC(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 8. Create order_history table for tracking
    console.log('📋 Creating order_history table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        description TEXT,
        transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 9. Create accounting_snapshots table
    console.log('📋 Creating accounting_snapshots table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounting_snapshots (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        snapshot_type TEXT NOT NULL,
        total_amount_usd NUMERIC(12,2) DEFAULT 0,
        total_amount_lbp BIGINT DEFAULT 0,
        net_balance_usd NUMERIC(12,2) DEFAULT 0,
        net_balance_lbp BIGINT DEFAULT 0,
        snapshot_data JSONB,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 10. Create driver_operations table
    console.log('📋 Creating driver_operations table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_operations (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        operation_type TEXT NOT NULL,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        description TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 11. Create indexes for performance
    console.log('📋 Creating indexes...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(customer_name);
      CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(actor_type, actor_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);
      CREATE INDEX IF NOT EXISTS idx_drivers_full_name ON drivers(full_name);
      CREATE INDEX IF NOT EXISTS idx_delivery_prices_region ON delivery_prices(country, region, sub_region);
    `);

    // 12. Update existing data to have proper defaults
    console.log('📋 Updating existing data...');
    
    // Update orders with default prepaid_status
    await pool.query(`
      UPDATE orders 
      SET prepaid_status = payment_status 
      WHERE prepaid_status IS NULL
    `);
    
    // Update orders with default delivery_mode
    await pool.query(`
      UPDATE orders 
      SET delivery_mode = 'direct' 
      WHERE delivery_mode IS NULL
    `);

    console.log('✅ ERP System Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
