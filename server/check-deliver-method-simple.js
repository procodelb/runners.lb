// Simple database check using existing connection
const { query } = require('./config/database');

async function checkDeliverMethod() {
  console.log('🔧 Checking deliver_method field...\n');

  // Wait for database initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Check existing values
    console.log('1. Checking existing deliver_method values...');
    const valuesResult = await query(`
      SELECT deliver_method, COUNT(*) as count
      FROM orders 
      WHERE deliver_method IS NOT NULL
      GROUP BY deliver_method
      ORDER BY count DESC
    `);
    
    console.log('   📊 Current values in database:');
    if (valuesResult.length > 0) {
      valuesResult.forEach(row => {
        console.log(`      "${row.deliver_method}": ${row.count} orders`);
      });
    } else {
      console.log('      No orders found');
    }

    // Check for NULL values
    const nullResult = await query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE deliver_method IS NULL
    `);
    
    if (nullResult[0].count > 0) {
      console.log(`   ⚠️  ${nullResult[0].count} orders have NULL deliver_method`);
      
      // Fix NULL values
      console.log('\n2. Fixing NULL values...');
      await query(`
        UPDATE orders 
        SET deliver_method = 'in_house' 
        WHERE deliver_method IS NULL
      `);
      console.log('   ✅ Updated NULL values to "in_house"');
    }

    // Check for third_party orders
    console.log('\n3. Checking for third_party orders...');
    const thirdPartyResult = await query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE deliver_method = 'third_party'
    `);
    
    const thirdPartyCount = thirdPartyResult[0].count;
    console.log(`   📊 Third party orders: ${thirdPartyCount}`);
    
    if (thirdPartyCount === 0) {
      console.log('   ⚠️  No third party orders found!');
      console.log('   💡 This explains why the filter shows no results');
      console.log('   🔧 Creating a test third party order...');
      
      // Create a test third party order
      await query(`
        INSERT INTO orders (
          order_ref, 
          customer_name, 
          customer_phone, 
          customer_address,
          deliver_method,
          third_party_name,
          status,
          payment_status,
          total_usd,
          total_lbp,
          created_at
        ) VALUES (
          'TEST-TP-001',
          'Test Customer',
          '123456789',
          'Test Address',
          'third_party',
          'Test Third Party',
          'new',
          'unpaid',
          10.00,
          890000,
          NOW()
        )
      `);
      
      console.log('   ✅ Created test third party order');
    }

    console.log('\n✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkDeliverMethod();
