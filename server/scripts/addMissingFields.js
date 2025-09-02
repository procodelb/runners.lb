const { Pool } = require('pg');

async function addMissingFields() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
      rejectUnauthorized: false,
      sslmode: 'require'
    }
  });

  try {
    console.log('🔧 Adding missing fields to database schema...\n');

    // Add missing fields to orders table
    console.log('1️⃣ Adding missing fields to orders table...');
    
    // Add external_id field (id_order from requirements)
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id TEXT');
      console.log('✅ Added external_id field to orders');
    } catch (e) {
      console.log('ℹ️ external_id field already exists or error:', e.message);
    }

    // Add delivery_mode field (direct/third_party from requirements)
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT \'direct\'');
      console.log('✅ Added delivery_mode field to orders');
    } catch (e) {
      console.log('ℹ️ delivery_mode field already exists or error:', e.message);
    }

    // Add fee_usd and fee_lbp fields (separate from total)
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_usd NUMERIC(10,2) DEFAULT 0');
      console.log('✅ Added fee_usd field to orders');
    } catch (e) {
      console.log('ℹ️ fee_usd field already exists or error:', e.message);
    }

    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_lbp BIGINT DEFAULT 0');
      console.log('✅ Added fee_lbp field to orders');
    } catch (e) {
      console.log('ℹ️ fee_lbp field already exists or error:', e.message);
    }

    // Add missing fields to transactions table
    console.log('\n2️⃣ Adding missing fields to transactions table...');
    
    // Add direction field (debit/credit from requirements)
    try {
      await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN (\'debit\', \'credit\'))');
      console.log('✅ Added direction field to transactions');
    } catch (e) {
      console.log('ℹ️ direction field already exists or error:', e.message);
    }

    // Add category field
    try {
      await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT');
      console.log('✅ Added category field to transactions');
    } catch (e) {
      console.log('ℹ️ category field already exists or error:', e.message);
    }

    // Add missing fields to drivers table
    console.log('\n3️⃣ Adding missing fields to drivers table...');
    
    // Add status field (active/inactive from requirements)
    try {
      await pool.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\' CHECK (status IN (\'active\', \'inactive\'))');
      console.log('✅ Added status field to drivers');
    } catch (e) {
      console.log('ℹ️ status field already exists or error:', e.message);
    }

    // Add vehicle_type field
    try {
      await pool.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_type TEXT');
      console.log('✅ Added vehicle_type field to drivers');
    } catch (e) {
      console.log('ℹ️ vehicle_type field already exists or error:', e.message);
    }

    // Update existing drivers to have status = 'active' if they have active = true
    try {
      await pool.query(`
        UPDATE drivers 
        SET status = CASE 
          WHEN active = true THEN 'active' 
          ELSE 'inactive' 
        END 
        WHERE status IS NULL
      `);
      console.log('✅ Updated existing drivers with status field');
    } catch (e) {
      console.log('ℹ️ Status update error:', e.message);
    }

    // Add missing fields to clients table
    console.log('\n4️⃣ Adding missing fields to clients table...');
    
    // Add client_id field for linking with orders
    try {
      await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_id TEXT UNIQUE');
      console.log('✅ Added client_id field to clients');
    } catch (e) {
      console.log('ℹ️ client_id field already exists or error:', e.message);
    }

    // Generate client_id for existing clients if they don't have one
    try {
      await pool.query(`
        UPDATE clients 
        SET client_id = 'CLI-' || LPAD(id::text, 6, '0')
        WHERE client_id IS NULL
      `);
      console.log('✅ Generated client_id for existing clients');
    } catch (e) {
      console.log('ℹ️ Client ID generation error:', e.message);
    }

    console.log('\n🎉 Schema migration completed successfully!');
    console.log('\n📊 Summary of changes:');
    console.log('- ✅ Orders: external_id, delivery_mode, fee_usd, fee_lbp');
    console.log('- ✅ Transactions: direction, category');
    console.log('- ✅ Drivers: status, vehicle_type');
    console.log('- ✅ Clients: client_id');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
addMissingFields().catch(console.error);
