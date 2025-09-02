const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function testExactDashboardQueries() {
  try {
    console.log('🔧 Testing exact dashboard queries...');

    // Test 1: Total orders
    console.log('\n1️⃣ Testing total orders query...');
    const totalOrdersQuery = 'SELECT COUNT(*) as total_orders FROM orders';
    const totalOrdersResult = await pool.query(totalOrdersQuery);
    const totalOrders = totalOrdersResult.rows[0]?.total_orders || 0;
    console.log('✅ Total orders:', totalOrders);

    // Test 2: Pending orders
    console.log('\n2️⃣ Testing pending orders query...');
    const pendingOrdersQuery = "SELECT COUNT(*) as pending_orders FROM orders WHERE status IN ('new','pending')";
    const pendingOrdersResult = await pool.query(pendingOrdersQuery);
    const pendingOrders = pendingOrdersResult.rows[0]?.pending_orders || 0;
    console.log('✅ Pending orders:', pendingOrders);

    // Test 3: Completed orders
    console.log('\n3️⃣ Testing completed orders query...');
    const completedOrdersQuery = "SELECT COUNT(*) as completed_orders FROM orders WHERE status = 'completed'";
    const completedOrdersResult = await pool.query(completedOrdersQuery);
    const completedOrders = completedOrdersResult.rows[0]?.completed_orders || 0;
    console.log('✅ Completed orders:', completedOrders);

    // Test 4: Total clients
    console.log('\n4️⃣ Testing total clients query...');
    const totalClientsQuery = 'SELECT COUNT(*) as total_clients FROM clients';
    const totalClientsResult = await pool.query(totalClientsQuery);
    const totalClients = totalClientsResult.rows[0]?.total_clients || 0;
    console.log('✅ Total clients:', totalClients);

    // Test 5: Active drivers
    console.log('\n5️⃣ Testing active drivers query...');
    const activeDriversQuery = 'SELECT COUNT(*) as active_drivers FROM drivers WHERE active = true';
    const activeDriversResult = await pool.query(activeDriversQuery);
    const activeDrivers = activeDriversResult.rows[0]?.active_drivers || 0;
    console.log('✅ Active drivers:', activeDrivers);

    // Test 6: Total revenue
    console.log('\n6️⃣ Testing total revenue query...');
    const totalRevenueQuery = `
      SELECT 
        COALESCE(SUM(delivery_fee_usd), 0) as total_revenue_usd,
        COALESCE(SUM(delivery_fee_lbp), 0) as total_revenue_lbp
      FROM orders 
      WHERE status = 'completed' AND payment_status = 'paid'
    `;
    const totalRevenueResult = await pool.query(totalRevenueQuery);
    const totalRevenue = {
      usd: parseFloat(totalRevenueResult.rows[0]?.total_revenue_usd) || 0,
      lbp: parseInt(totalRevenueResult.rows[0]?.total_revenue_lbp) || 0
    };
    console.log('✅ Total revenue:', totalRevenue);

    // Test 7: Pending payments
    console.log('\n7️⃣ Testing pending payments query...');
    const pendingPaymentsQuery = `
      SELECT 
        COALESCE(SUM(total_usd), 0) as pending_usd,
        COALESCE(SUM(total_lbp), 0) as pending_lbp
      FROM orders 
      WHERE payment_status = 'unpaid'
    `;
    const pendingPaymentsResult = await pool.query(pendingPaymentsQuery);
    const pendingPayments = {
      usd: parseFloat(pendingPaymentsResult.rows[0]?.pending_usd) || 0,
      lbp: parseInt(pendingPaymentsResult.rows[0]?.pending_lbp) || 0
    };
    console.log('✅ Pending payments:', pendingPayments);

    // Test 8: Orders by status (with ::int casting)
    console.log('\n8️⃣ Testing orders by status query (with ::int casting)...');
    const ordersByStatusQuery = `
      SELECT status, COUNT(*)::int as count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `;
    const ordersByStatusResult = await pool.query(ordersByStatusQuery);
    console.log('✅ Orders by status:', ordersByStatusResult.rows);

    // Test 9: Revenue by month
    console.log('\n9️⃣ Testing revenue by month query...');
    const revenueByMonthQuery = `
      SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') as month,
             COALESCE(SUM(delivery_fee_usd),0) as revenue_usd,
             COALESCE(SUM(delivery_fee_lbp),0) as revenue_lbp
      FROM orders
      WHERE status='completed' AND payment_status='paid'
      GROUP BY 1
      ORDER BY month DESC
      LIMIT 12
    `;
    const revenueByMonthResult = await pool.query(revenueByMonthQuery);
    console.log('✅ Revenue by month:', revenueByMonthResult.rows);

    // Test 10: Top clients (with ::int casting)
    console.log('\n🔟 Testing top clients query (with ::int casting)...');
    const topClientsQuery = `
      SELECT c.id as client_id, c.business_name,
             COALESCE(SUM(o.delivery_fee_usd),0) as total_usd,
             COALESCE(SUM(o.delivery_fee_lbp),0) as total_lbp,
             COUNT(o.id)::int as orders_count
      FROM clients c
      JOIN orders o ON o.brand_name = c.business_name
      WHERE o.status='completed' AND o.payment_status='paid'
      GROUP BY c.id, c.business_name
      ORDER BY total_usd DESC, total_lbp DESC
      LIMIT 10
    `;
    const topClientsResult = await pool.query(topClientsQuery);
    console.log('✅ Top clients:', topClientsResult.rows);

    // Test 11: Driver performance (with ::int casting)
    console.log('\n1️⃣1️⃣ Testing driver performance query (with ::int casting)...');
    const driverPerformanceQuery = `
      SELECT d.id as driver_id, d.full_name,
             COUNT(o.id)::int as deliveries_count,
             COALESCE(SUM(o.driver_fee_usd),0) as earnings_usd,
             COALESCE(SUM(o.driver_fee_lbp),0) as earnings_lbp
      FROM drivers d
      LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('delivered','completed')
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      ORDER BY deliveries_count DESC
      LIMIT 10
    `;
    const driverPerformanceResult = await pool.query(driverPerformanceQuery);
    console.log('✅ Driver performance:', driverPerformanceResult.rows);

    console.log('\n🎉 All exact dashboard queries executed successfully!');

  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('SQL State:', error.code);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
  } finally {
    await pool.end();
  }
}

testExactDashboardQueries();
