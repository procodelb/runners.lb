const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateCashboxSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Updating cashbox schema...');
    
    // 1. Update cashbox table to support capital management and account types
    await client.query(`
      ALTER TABLE cashbox 
      ADD COLUMN IF NOT EXISTS initial_capital_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS initial_capital_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cash_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cash_balance_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wish_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wish_balance_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS capital_set_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS capital_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // 2. Update cashbox_entries to support account types and enhanced categories
    await client.query(`
      ALTER TABLE cashbox_entries 
      ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('cash', 'wish')) DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS subcategory TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
    `);
    
    // 3. Update entry_type constraint to include new types
    await client.query(`
      ALTER TABLE cashbox_entries 
      DROP CONSTRAINT IF EXISTS cashbox_entries_entry_type_check;
    `);
    
    await client.query(`
      ALTER TABLE cashbox_entries 
      ADD CONSTRAINT cashbox_entries_entry_type_check 
      CHECK (entry_type IN (
        'cash_in', 'cash_out', 'driver_advance', 'driver_return', 
        'client_payment', 'income', 'expense', 'capital_add', 
        'capital_edit', 'order_income', 'delivery_fee'
      ));
    `);
    
    // 4. Create expense categories table for better organization
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        items TEXT[] NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    // 5. Insert predefined expense categories
    await client.query(`
      INSERT INTO expense_categories (title, items) VALUES
      ('Operations / Fleet', ARRAY[
        'Driver Salaries & Wages',
        'Driver Overtime', 
        'Delivery Fees Paid to Subcontractors',
        'Fuel Expense',
        'Vehicle Maintenance & Repairs',
        'Vehicle Insurance',
        'Vehicle Registration & Licensing',
        'Bike/Car Rental'
      ]),
      ('Staff & HR', ARRAY[
        'Staff Salaries & Wages',
        'Employee Benefits',
        'Training & Recruitment'
      ]),
      ('Office & Admin', ARRAY[
        'Rent',
        'Utilities',
        'Office Supplies',
        'Software Subscriptions',
        'Phone & Communication',
        'Bank Fees & Charges',
        'Professional Fees'
      ]),
      ('Marketing & Sales', ARRAY[
        'Advertising & Promotions',
        'Branding & Design',
        'Sponsorships / Community Events'
      ]),
      ('Operations Support', ARRAY[
        'Packaging Materials',
        'Uniforms'
      ]),
      ('Technology & Systems', ARRAY[
        'Website & Hosting',
        'App Development & Maintenance',
        'IT Support & Repairs'
      ]),
      ('Financial & Other', ARRAY[
        'Depreciation',
        'Currency Exchange / Transfer Fees',
        'Miscellaneous Expenses'
      ])
      ON CONFLICT DO NOTHING;
    `);
    
    // 6. Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_account_type ON cashbox_entries(account_type);
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_category ON cashbox_entries(category);
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_order_id ON cashbox_entries(order_id);
    `);
    
    // 7. Initialize cash and wish balances from current balance if not set
    await client.query(`
      UPDATE cashbox 
      SET 
        cash_balance_usd = COALESCE(cash_balance_usd, balance_usd),
        cash_balance_lbp = COALESCE(cash_balance_lbp, balance_lbp),
        wish_balance_usd = COALESCE(wish_balance_usd, 0),
        wish_balance_lbp = COALESCE(wish_balance_lbp, 0)
      WHERE id = 1;
    `);
    
    console.log('✅ Cashbox schema updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating cashbox schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await updateCashboxSchema();
    console.log('🎉 Schema update completed!');
  } catch (error) {
    console.error('💥 Schema update failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateCashboxSchema };
