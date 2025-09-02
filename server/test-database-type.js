const { query, currentDatabase } = require('./config/database');

async function testDatabaseType() {
  try {
    console.log('🔧 Testing database type...');
    
    // Wait for database initialization
    let attempts = 0;
    while (currentDatabase() === 'unknown' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    console.log('Current database:', currentDatabase());
    
    // Test a simple query
    const result = await query('SELECT 1 as test');
    console.log('Query result:', result);
    
    // Test a query that would fail in SQLite but work in PostgreSQL
    try {
      const pgResult = await query("SELECT 'test'::text as test");
      console.log('PostgreSQL-specific query result:', pgResult);
      console.log('✅ Using PostgreSQL');
    } catch (error) {
      console.log('❌ PostgreSQL-specific query failed:', error.message);
      console.log('❌ Using SQLite');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDatabaseType();
