const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateCashboxPaymentRules() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Migrating Cashbox Payment Rules...');
    
    await client.query('BEGIN');
    
    // 1. Add cashbox tracking flags to orders table
    console.log('📋 Adding cashbox tracking fields to orders...');
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS cashbox_applied_on_create BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS cashbox_applied_on_delivery BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS cashbox_applied_on_paid BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS cashbox_history_moved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS accounting_cashed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS moved_to_history BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS third_party_fee_usd NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS third_party_fee_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS moved_at TIMESTAMPTZ
    `);
    
    // 2. Update cashbox table to ensure proper structure
    console.log('📋 Updating cashbox table structure...');
    await client.query(`
      ALTER TABLE cashbox 
      ADD COLUMN IF NOT EXISTS cash_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cash_balance_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wish_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wish_balance_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS initial_capital_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS initial_capital_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS capital_set_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS capital_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    
    // Initialize cashbox row if it doesn't exist
    await client.query(`
      INSERT INTO cashbox (id, balance_usd, balance_lbp, cash_balance_usd, cash_balance_lbp, wish_balance_usd, wish_balance_lbp)
      VALUES (1, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // 3. Update cashbox_entries to support new entry types and add order_id
    console.log('📋 Updating cashbox_entries structure...');
    await client.query(`
      ALTER TABLE cashbox_entries 
      ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('cash', 'wish')) DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS subcategory TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);
    
    // Drop old constraint and add new one with more entry types
    await client.query(`
      ALTER TABLE cashbox_entries 
      DROP CONSTRAINT IF EXISTS cashbox_entries_entry_type_check
    `);
    
    await client.query(`
      ALTER TABLE cashbox_entries 
      ADD CONSTRAINT cashbox_entries_entry_type_check 
      CHECK (entry_type IN (
        'cash_in', 'cash_out', 'order_cash_in', 'order_cash_out', 
        'client_cashout', 'prepaid_cashout', 'driver_advance', 'driver_return',
        'driver_payout', 'third_party_payable', 'capital_add',
        'capital_edit', 'income', 'expense', 'capital_expense'
      ))
    `);
    
    // 4. Update transactions table to ensure order_id exists
    console.log('📋 Updating transactions structure...');
    await client.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL
    `);
    
    // 5. Create clients table if it doesn't exist
    console.log('📋 Ensuring clients table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        business_name TEXT,
        contact_person TEXT,
        phone TEXT,
        address TEXT,
        instagram TEXT,
        website TEXT,
        category TEXT,
        old_balance_usd NUMERIC(12,2) DEFAULT 0,
        old_balance_lbp BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    // 6. Create indexes for performance
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_order_id ON cashbox_entries(order_id);
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_entry_type ON cashbox_entries(entry_type);
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_created_at ON cashbox_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_cashbox_flags ON orders(cashbox_applied_on_create, cashbox_applied_on_delivery);
      CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
    `);
    
    await client.query('COMMIT');
    console.log('✅ Cashbox Payment Rules migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrateCashboxPaymentRules()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateCashboxPaymentRules };

