// Database schema check and fix for deliver_method field
const { Pool } = require('pg');

async function checkAndFixDeliverMethod() {
  console.log('🔧 Checking and fixing deliver_method field...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check current schema
    console.log('1. Checking current deliver_method field...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'deliver_method'
    `);
    
    if (schemaResult.rows.length > 0) {
      const field = schemaResult.rows[0];
      console.log(`   ✅ Field exists: ${field.column_name}`);
      console.log(`   📋 Data type: ${field.data_type}`);
      console.log(`   📋 Default: ${field.column_default}`);
      console.log(`   📋 Nullable: ${field.is_nullable}`);
    } else {
      console.log('   ❌ deliver_method field does not exist!');
    }

    // Check existing values
    console.log('\n2. Checking existing deliver_method values...');
    const valuesResult = await pool.query(`
      SELECT deliver_method, COUNT(*) as count
      FROM orders 
      WHERE deliver_method IS NOT NULL
      GROUP BY deliver_method
      ORDER BY count DESC
    `);
    
    console.log('   📊 Current values in database:');
    valuesResult.rows.forEach(row => {
      console.log(`      "${row.deliver_method}": ${row.count} orders`);
    });

    // Check for NULL values
    const nullResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE deliver_method IS NULL
    `);
    
    if (nullResult.rows[0].count > 0) {
      console.log(`   ⚠️  ${nullResult.rows[0].count} orders have NULL deliver_method`);
    }

    // Fix NULL values by setting default
    if (nullResult.rows[0].count > 0) {
      console.log('\n3. Fixing NULL values...');
      await pool.query(`
        UPDATE orders 
        SET deliver_method = 'in_house' 
        WHERE deliver_method IS NULL
      `);
      console.log('   ✅ Updated NULL values to "in_house"');
    }

    // Ensure we have some third_party orders for testing
    console.log('\n4. Checking for third_party orders...');
    const thirdPartyResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE deliver_method = 'third_party'
    `);
    
    const thirdPartyCount = thirdPartyResult.rows[0].count;
    console.log(`   📊 Third party orders: ${thirdPartyCount}`);
    
    if (thirdPartyCount === 0) {
      console.log('   ⚠️  No third party orders found - this might be why filter shows no results');
      console.log('   💡 Consider creating some test orders with deliver_method = "third_party"');
    }

    console.log('\n✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAndFixDeliverMethod();
