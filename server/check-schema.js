const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check orders table columns
    const ordersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Orders table columns:');
    ordersColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check if customers table exists
    const customersTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customers'
      );
    `);
    
    console.log('\n👥 Customers table exists:', customersTable.rows[0].exists);
    
    // Check drivers table columns
    const driversColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n🚗 Drivers table columns:');
    driversColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Test the problematic query
    console.log('\n🧪 Testing drivers query...');
    const testQuery = await pool.query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        o.driver_id,
        o.price_usd as total_usd,
        o.price_lbp as total_lbp,
        o.driver_fee_usd as fee_usd,
        o.driver_fee_lbp as fee_lbp,
        cust.name as customer_name,
        cust.location as customer_location,
        cust.phone as customer_phone,
        d.full_name as driver_name,
        o.created_at as date,
        o.payment_status,
        o.status as order_status,
        o.deliver_method as delivery_method
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN customers cust ON o.customer_id = cust.id
      WHERE o.deliver_method = 'in_house' AND o.driver_id IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    console.log('✅ Drivers query successful:', testQuery.rows.length, 'rows');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
