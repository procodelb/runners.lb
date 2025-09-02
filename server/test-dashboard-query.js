const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function testQueries() {
  try {
    console.log('🔧 Testing individual dashboard queries...');

    // Test 1: Total orders
    console.log('\n1️⃣ Testing total orders query...');
    const totalOrdersResult = await pool.query('SELECT COUNT(*) as total_orders FROM orders');
    console.log('✅ Total orders:', totalOrdersResult.rows[0]?.total_orders);

    // Test 2: Pending orders
    console.log('\n2️⃣ Testing pending orders query...');
    const pendingOrdersResult = await pool.query("SELECT COUNT(*) as pending_orders FROM orders WHERE status IN ('new','pending')");
    console.log('✅ Pending orders:', pendingOrdersResult.rows[0]?.pending_orders);

    // Test 3: Completed orders
    console.log('\n3️⃣ Testing completed orders query...');
    const completedOrdersResult = await pool.query("SELECT COUNT(*) as completed_orders FROM orders WHERE status = 'completed'");
    console.log('✅ Completed orders:', completedOrdersResult.rows[0]?.completed_orders);

    // Test 4: Total clients
    console.log('\n4️⃣ Testing total clients query...');
    const totalClientsResult = await pool.query('SELECT COUNT(*) as total_clients FROM clients');
    console.log('✅ Total clients:', totalClientsResult.rows[0]?.total_clients);

    // Test 5: Active drivers
    console.log('\n5️⃣ Testing active drivers query...');
    const activeDriversResult = await pool.query('SELECT COUNT(*) as active_drivers FROM drivers WHERE active = true');
    console.log('✅ Active drivers:', activeDriversResult.rows[0]?.active_drivers);

    // Test 6: Total revenue
    console.log('\n6️⃣ Testing total revenue query...');
    const totalRevenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(delivery_fee_usd), 0) as total_revenue_usd,
        COALESCE(SUM(delivery_fee_lbp), 0) as total_revenue_lbp
      FROM orders 
      WHERE status = 'completed' AND payment_status = 'paid'
    `);
    console.log('✅ Total revenue:', totalRevenueResult.rows[0]);

    // Test 7: Pending payments
    console.log('\n7️⃣ Testing pending payments query...');
    const pendingPaymentsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(total_usd), 0) as pending_usd,
        COALESCE(SUM(total_lbp), 0) as pending_lbp
      FROM orders 
      WHERE payment_status = 'unpaid'
    `);
    console.log('✅ Pending payments:', pendingPaymentsResult.rows[0]);

    // Test 8: Orders by status
    console.log('\n8️⃣ Testing orders by status query...');
    const ordersByStatusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('✅ Orders by status:', ordersByStatusResult.rows);

    // Test 9: Revenue by month
    console.log('\n9️⃣ Testing revenue by month query...');
    const revenueByMonthResult = await pool.query(`
      SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') as month,
             COALESCE(SUM(delivery_fee_usd),0) as revenue_usd,
             COALESCE(SUM(delivery_fee_lbp),0) as revenue_lbp
      FROM orders
      WHERE status='completed' AND payment_status='paid'
      GROUP BY 1
      ORDER BY month DESC
      LIMIT 12
    `);
    console.log('✅ Revenue by month:', revenueByMonthResult.rows);

    // Test 10: Top clients
    console.log('\n🔟 Testing top clients query...');
    const topClientsResult = await pool.query(`
      SELECT c.id as client_id, c.business_name,
             COALESCE(SUM(o.delivery_fee_usd),0) as total_usd,
             COALESCE(SUM(o.delivery_fee_lbp),0) as total_lbp,
             COUNT(o.id) as orders_count
      FROM clients c
      JOIN orders o ON o.brand_name = c.business_name
      WHERE o.status='completed' AND o.payment_status='paid'
      GROUP BY c.id, c.business_name
      ORDER BY total_usd DESC, total_lbp DESC
      LIMIT 10
    `);
    console.log('✅ Top clients:', topClientsResult.rows);

    // Test 11: Driver performance
    console.log('\n1️⃣1️⃣ Testing driver performance query...');
    const driverPerformanceResult = await pool.query(`
      SELECT 
        d.id as driver_id, d.full_name,
        COUNT(o.id) as deliveries_count,
        COALESCE(SUM(o.driver_fee_usd),0) as earnings_usd,
        COALESCE(SUM(o.driver_fee_lbp),0) as earnings_lbp
      FROM drivers d
      LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('delivered','completed')
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      ORDER BY deliveries_count DESC
      LIMIT 10
    `);
    console.log('✅ Driver performance:', driverPerformanceResult.rows);

    console.log('\n🎉 All queries executed successfully!');

  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('SQL State:', error.code);
    console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

testQueries();
