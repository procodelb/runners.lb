const { Pool } = require('pg');
require('dotenv').config();

async function testOrderCreation() {
  console.log('🧪 Testing Order Creation Fix...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test the exact query that was failing
    const testOrderData = {
      order_ref: 'TEST-ORDER-FIX',
      brand_name: 'test',
      client_id: null,
      customer_name: 'Test Customer',
      customer_phone: '123456789',
      customer_address: 'Test Address',
      driver_id: null,
      type: 'ecommerce',
      deliver_method: 'in_house',
      status: 'new',
      payment_status: 'unpaid',
      notes: 'Test order',
      total_usd: 0,
      total_lbp: 0,
      delivery_fee_usd: 0,  // Fixed: was delivery_fees_usd
      delivery_fee_lbp: 0,  // Fixed: was delivery_fees_lbp
      third_party_fee_usd: 0,
      third_party_fee_lbp: 0,
      driver_fee_usd: 0,
      driver_fee_lbp: 0
    };

    const columns = Object.keys(testOrderData).join(', ');
    const values = Object.values(testOrderData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO orders (${columns}) VALUES (${placeholders}) RETURNING *`;
    
    console.log('📝 Testing SQL:', sql.substring(0, 100) + '...');
    console.log('📊 Values:', values.slice(0, 5), '...');

    const result = await pool.query(sql, values);
    
    console.log('✅ Order creation test PASSED!');
    console.log('📋 Created order ID:', result.rows[0].id);
    
    // Clean up test order
    await pool.query('DELETE FROM orders WHERE order_ref = $1', ['TEST-ORDER-FIX']);
    console.log('🧹 Test order cleaned up');
    
  } catch (error) {
    console.error('❌ Order creation test FAILED:', error.message);
    console.error('🔍 Error details:', error);
  } finally {
    await pool.end();
  }
}

testOrderCreation();
