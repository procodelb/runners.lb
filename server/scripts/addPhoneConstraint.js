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

async function addPhoneConstraint() {
  console.log('🔧 Adding unique constraint to phone column...');
  
  try {
    // Add unique constraint to phone column
    await pool.query(`
      ALTER TABLE customers 
      ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
    `);
    
    console.log('✅ Unique constraint added to phone column!');
    
    // Test the constraint
    console.log('🧪 Testing unique constraint...');
    await pool.query(`
      INSERT INTO customers (phone, name, address) 
      VALUES ($1, $2, $3)
    `, ['+96170123456', 'Test Customer', 'Test Address']);
    
    console.log('✅ Test insert successful!');
    
  } catch (error) {
    if (error.code === '23505') {
      console.log('✅ Unique constraint already exists or phone already exists');
    } else {
      console.error('❌ Error adding constraint:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

// Run the fix
addPhoneConstraint()
  .then(() => {
    console.log('🎉 Phone constraint added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });
