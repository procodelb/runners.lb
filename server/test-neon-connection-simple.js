const { query, run, currentDatabase } = require('./config/database');

async function testNeonConnection() {
  try {
    console.log('🔧 Testing Neon database connection...');
    
    // Wait for database to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📊 Current database:', currentDatabase());
    
    // Test a simple query
    const result = await query('SELECT 1 as test, current_database() as db_name, version() as db_version');
    console.log('✅ Query result:', result[0]);
    
    // Test users table
    const users = await query('SELECT COUNT(*) as count FROM users');
    console.log('✅ Users count:', users[0].count);
    
    // Test orders table
    const orders = await query('SELECT COUNT(*) as count FROM orders');
    console.log('✅ Orders count:', orders[0].count);
    
    // Test cashbox table
    const cashbox = await query('SELECT * FROM cashbox LIMIT 1');
    console.log('✅ Cashbox data:', cashbox[0]);
    
    console.log('🎉 All Neon database tests passed!');
    console.log('✅ Backend is successfully using Neon PostgreSQL');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testNeonConnection();
