const { Pool } = require('pg');

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

async function fixCustomerTable() {
  console.log('🔧 Fixing customers table structure...');
  
  try {
    // First, check if the table exists and what columns it has
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current table structure:');
    tableCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check if address column exists
    const hasAddress = tableCheck.rows.some(row => row.column_name === 'address');
    
    if (!hasAddress) {
      console.log('🔧 Adding missing address column...');
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN address TEXT;
      `);
      console.log('✅ Address column added successfully!');
    } else {
      console.log('✅ Address column already exists');
    }

    // Verify the final structure
    const finalCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Final table structure:');
    finalCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Test the table with a sample query
    console.log('🧪 Testing table with sample query...');
    const testQuery = await pool.query(`
      SELECT phone, name, address, created_at, updated_at
      FROM customers 
      LIMIT 1
    `);
    console.log('✅ Table structure is working correctly!');

  } catch (error) {
    console.error('❌ Error fixing customers table:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixCustomerTable()
  .then(() => {
    console.log('🎉 Customer table fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });
