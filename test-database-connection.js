// Test database connection
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

console.log('🧪 Testing Database Connection...\n');

async function testDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📡 Attempting to connect to database...');
    const client = await pool.connect();
    
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📊 Current database time:', result.rows[0].current_time);
    
    // Test users table
    const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
    console.log('👥 Total users in database:', usersResult.rows[0].user_count);
    
    client.release();
    await pool.end();
    
    console.log('✅ Database test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  }
}

testDatabase().catch(console.error);