const { Pool } = require('pg');

// Set environment variables for Neon
process.env.USE_SQLITE = 'false';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function fixMissingColumns() {
  console.log('🔧 Fixing missing columns in database...');

  try {
    // 1. Add missing columns to transactions table
    console.log('📋 Adding missing columns to transactions table...');
    
    // Add direction column
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('credit', 'debit'))
      `);
      console.log('✅ Added direction column to transactions');
    } catch (e) {
      console.log('ℹ️ direction column already exists or error:', e.message);
    }

    // Add category column
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS category TEXT
      `);
      console.log('✅ Added category column to transactions');
    } catch (e) {
      console.log('ℹ️ category column already exists or error:', e.message);
    }

    // Add updated_at column
    try {
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()
      `);
      console.log('✅ Added updated_at column to transactions');
    } catch (e) {
      console.log('ℹ️ updated_at column already exists or error:', e.message);
    }

    // 2. Ensure price_list table has consistent column names
    console.log('📋 Ensuring price_list table consistency...');
    
    // Check if area_name column exists and area doesn't
    try {
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'price_list' 
        AND column_name IN ('area', 'area_name')
      `);
      
      const hasArea = columns.rows.some(row => row.column_name === 'area');
      const hasAreaName = columns.rows.some(row => row.column_name === 'area_name');
      
      if (hasAreaName && !hasArea) {
        // Rename area_name to area for consistency
        await pool.query('ALTER TABLE price_list RENAME COLUMN area_name TO area');
        console.log('✅ Renamed area_name to area in price_list table');
      } else if (!hasArea && !hasAreaName) {
        // Add area column if neither exists
        await pool.query('ALTER TABLE price_list ADD COLUMN area TEXT');
        console.log('✅ Added area column to price_list table');
      }
    } catch (e) {
      console.log('ℹ️ price_list area column check:', e.message);
    }

    // 3. Ensure clients table exists with proper structure
    console.log('📋 Ensuring clients table exists...');
    
    try {
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
        )
      `);
      console.log('✅ Clients table ensured');
    } catch (e) {
      console.log('ℹ️ Clients table already exists or error:', e.message);
    }

    // 4. Create missing tables if they don't exist
    console.log('📋 Creating missing tables...');
    
    // Create order_history table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_history (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
          client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
          driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
          action_type TEXT NOT NULL CHECK (action_type IN ('cashout', 'payment', 'delivery', 'cancellation')),
          amount_usd NUMERIC(12,2) DEFAULT 0,
          amount_lbp BIGINT DEFAULT 0,
          description TEXT,
          transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('✅ order_history table ensured');
    } catch (e) {
      console.log('ℹ️ order_history table already exists or error:', e.message);
    }

    // Create accounting_snapshots table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounting_snapshots (
          id SERIAL PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'driver', 'third_party')),
          entity_id INTEGER NOT NULL,
          snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('cashout', 'balance_check', 'monthly_summary')),
          total_orders INTEGER DEFAULT 0,
          total_amount_usd NUMERIC(12,2) DEFAULT 0,
          total_amount_lbp BIGINT DEFAULT 0,
          total_fees_usd NUMERIC(12,2) DEFAULT 0,
          total_fees_lbp BIGINT DEFAULT 0,
          net_balance_usd NUMERIC(12,2) DEFAULT 0,
          net_balance_lbp BIGINT DEFAULT 0,
          snapshot_data JSONB,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('✅ accounting_snapshots table ensured');
    } catch (e) {
      console.log('ℹ️ accounting_snapshots table already exists or error:', e.message);
    }

    // Create driver_operations table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS driver_operations (
          id SERIAL PRIMARY KEY,
          driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
          operation_type TEXT NOT NULL CHECK (operation_type IN ('fuel_expense', 'maintenance', 'advance', 'return')),
          amount_usd NUMERIC(12,2) DEFAULT 0,
          amount_lbp BIGINT DEFAULT 0,
          description TEXT,
          order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('✅ driver_operations table ensured');
    } catch (e) {
      console.log('ℹ️ driver_operations table already exists or error:', e.message);
    }

    console.log('✅ All missing columns and tables have been fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing missing columns:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixMissingColumns()
    .then(() => {
      console.log('🎉 Database fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingColumns };
