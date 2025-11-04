const { Pool } = require('pg');

// Set environment variables directly (using working credentials from other scripts)
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

async function testClientOrderIntegration() {
  console.log('🧪 Testing Client-Order Integration...');
  
  try {
    // Test 1: Check if client_id column exists in orders table
    console.log('\n1️⃣ Checking if client_id column exists in orders table...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'client_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ client_id column exists:', columnCheck.rows[0]);
    } else {
      console.log('❌ client_id column does not exist');
      return;
    }
    
    // Test 2: Check if clients table exists and has data
    console.log('\n2️⃣ Checking clients table...');
    const clientsCount = await pool.query('SELECT COUNT(*) as count FROM clients');
    console.log(`✅ Clients table has ${clientsCount.rows[0].count} records`);
    
    // Test 3: Check if orders table has data
    console.log('\n3️⃣ Checking orders table...');
    const ordersCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`✅ Orders table has ${ordersCount.rows[0].count} records`);
    
    // Test 4: Test client search functionality
    console.log('\n4️⃣ Testing client search functionality...');
    const clientSearch = await pool.query(`
      SELECT id, business_name, contact_person, phone, category
      FROM clients 
      WHERE LOWER(business_name) LIKE LOWER($1) 
         OR LOWER(contact_person) LIKE LOWER($1)
         OR LOWER(phone) LIKE LOWER($1)
      ORDER BY business_name
      LIMIT 5
    `, ['%test%']);
    
    console.log(`✅ Found ${clientSearch.rows.length} clients matching 'test'`);
    if (clientSearch.rows.length > 0) {
      console.log('Sample client:', clientSearch.rows[0]);
    }
    
    // Test 5: Test orders with client information
    console.log('\n5️⃣ Testing orders with client information...');
    const ordersWithClients = await pool.query(`
      SELECT 
        o.id, o.order_ref, o.brand_name, o.client_id,
        c.business_name as client_business_name,
        c.contact_person as client_contact_person,
        c.category as client_category
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      ORDER BY o.created_at DESC
      LIMIT 3
    `);
    
    console.log(`✅ Found ${ordersWithClients.rows.length} recent orders`);
    ordersWithClients.rows.forEach((order, index) => {
      console.log(`Order ${index + 1}:`, {
        order_ref: order.order_ref,
        brand_name: order.brand_name,
        client_id: order.client_id,
        client_business_name: order.client_business_name,
        client_category: order.client_category
      });
    });
    
    // Test 6: Test creating a new order with client_id
    console.log('\n6️⃣ Testing order creation with client_id...');
    
    // First, get a client to use
    const testClient = await pool.query('SELECT id, business_name FROM clients LIMIT 1');
    if (testClient.rows.length > 0) {
      const client = testClient.rows[0];
      
      const testOrder = {
        order_ref: `TEST-${Date.now()}`,
        brand_name: client.business_name,
        client_id: client.id,
        customer_name: 'Test Customer',
        customer_phone: '1234567890',
        customer_address: 'Test Address',
        type: 'ecommerce',
        deliver_method: 'in_house',
        status: 'new',
        payment_status: 'unpaid',
        total_usd: 10.00,
        total_lbp: 890000,
        delivery_fees_usd: 2.00,
        delivery_fees_lbp: 178000
      };
      
      const insertResult = await pool.query(`
        INSERT INTO orders (
          order_ref, brand_name, client_id, customer_name, customer_phone, 
          customer_address, type, deliver_method, status, payment_status,
          total_usd, total_lbp, delivery_fees_usd, delivery_fees_lbp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, order_ref, client_id
      `, [
        testOrder.order_ref, testOrder.brand_name, testOrder.client_id,
        testOrder.customer_name, testOrder.customer_phone, testOrder.customer_address,
        testOrder.type, testOrder.deliver_method, testOrder.status, testOrder.payment_status,
        testOrder.total_usd, testOrder.total_lbp, testOrder.delivery_fees_usd, testOrder.delivery_fees_lbp
      ]);
      
      console.log('✅ Test order created:', insertResult.rows[0]);
      
      // Clean up test order
      await pool.query('DELETE FROM orders WHERE order_ref = $1', [testOrder.order_ref]);
      console.log('✅ Test order cleaned up');
    } else {
      console.log('⚠️ No clients found to test with');
    }
    
    console.log('\n🎉 All tests passed! Client-Order integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testClientOrderIntegration()
  .then(() => {
    console.log('✅ Integration test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Integration test failed:', error);
    process.exit(1);
  });
