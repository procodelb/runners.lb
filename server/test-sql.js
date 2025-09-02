const { query } = require('./config/database');

// Test SQL queries directly
async function testSQL() {
  try {
    console.log('🧪 Testing SQL Queries Directly...\n');

    // Test 1: Simple query
    console.log('1️⃣ Testing simple query...');
    try {
      const result = await query('SELECT COUNT(*) as count FROM orders');
      console.log('✅ Simple query successful:', result[0]?.count);
    } catch (error) {
      console.log('❌ Simple query failed:', error.message);
    }

    // Test 2: Query with WHERE clause
    console.log('\n2️⃣ Testing query with WHERE clause...');
    try {
      const result = await query("SELECT COUNT(*) as count FROM orders WHERE status = 'completed'");
      console.log('✅ WHERE query successful:', result[0]?.count);
    } catch (error) {
      console.log('❌ WHERE query failed:', error.message);
    }

    // Test 3: Query with date filter
    console.log('\n3️⃣ Testing query with date filter...');
    try {
      const dateFilter = 'WHERE created_at >= ?';
      const sqlQuery = `SELECT COUNT(*) as count FROM orders ${dateFilter} AND status = 'completed'`;
      console.log('🔍 SQL Query:', sqlQuery);
      const result = await query(sqlQuery, ['2024-01-01']);
      console.log('✅ Date filter query successful:', result[0]?.count);
    } catch (error) {
      console.log('❌ Date filter query failed:', error.message);
    }

    // Test 4: Query without date filter
    console.log('\n4️⃣ Testing query without date filter...');
    try {
      const sqlQuery = `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`;
      console.log('🔍 SQL Query:', sqlQuery);
      const result = await query(sqlQuery);
      console.log('✅ No date filter query successful:', result[0]?.count);
    } catch (error) {
      console.log('❌ No date filter query failed:', error.message);
    }

    console.log('\n🎉 SQL testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSQL();
