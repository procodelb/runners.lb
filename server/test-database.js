const { query, run } = require('./config/database');

async function testDatabase() {
  try {
    console.log('🧪 Testing Database Tables...\n');

    // Test 1: Check if clients table exists
    console.log('1️⃣ Testing clients table...');
    const clientsResult = await query('SELECT COUNT(*) as count FROM clients');
    console.log('✅ Clients table exists, count:', clientsResult[0].count);

    // Test 2: Check if transactions table exists
    console.log('\n2️⃣ Testing transactions table...');
    const transactionsResult = await query('SELECT COUNT(*) as count FROM transactions');
    console.log('✅ Transactions table exists, count:', transactionsResult[0].count);

    // Test 3: Check if drivers table exists
    console.log('\n3️⃣ Testing drivers table...');
    const driversResult = await query('SELECT COUNT(*) as count FROM drivers');
    console.log('✅ Drivers table exists, count:', driversResult[0].count);

    // Test 4: Test the exact query from transactions.js
    console.log('\n4️⃣ Testing transactions query with LEFT JOIN...');
    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `;
    
    const complexQueryResult = await query(transactionsQuery);
    console.log('✅ Complex transactions query successful, count:', complexQueryResult.length);

    // Test 5: Test dashboard stats query
    console.log('\n5️⃣ Testing dashboard stats query...');
    const dashboardQuery = `
      SELECT 
        COALESCE(SUM(total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(total_lbp), 0) as total_revenue_lbp
      FROM orders 
      WHERE status = 'completed' AND payment_status = 'paid'
    `;
    
    const dashboardResult = await query(dashboardQuery);
    console.log('✅ Dashboard stats query successful:', dashboardResult[0]);

    console.log('\n🎉 All database tests passed!');

  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Error details:', error.message);
  } finally {
    process.exit(0);
  }
}

testDatabase();
