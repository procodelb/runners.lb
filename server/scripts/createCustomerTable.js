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

async function createCustomerTable() {
  console.log('🔧 Creating customers table...');
  
  try {
    // Create customers table with phone as primary key
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    `);

    console.log('✅ Customers table created successfully!');
    console.log('📋 Table structure:');
    console.log('   - phone (TEXT PRIMARY KEY)');
    console.log('   - name (TEXT NOT NULL)');
    console.log('   - address (TEXT)');
    console.log('   - created_at (TIMESTAMPTZ)');
    console.log('   - updated_at (TIMESTAMPTZ)');

  } catch (error) {
    console.error('❌ Error creating customers table:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
createCustomerTable()
  .then(() => {
    console.log('🎉 Customer table migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
