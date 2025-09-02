const { Pool } = require('pg');

// Set environment variables for Neon
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.PG_SSL = 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, sslmode: 'require' }
});

async function verifyNeonData() {
  console.log('🔍 Verifying Neon database demo data...');

  try {
    await pool.query('SELECT 1 as test');
    console.log('✅ Connected to Neon database\n');

    // 1. Verify Admin User
    console.log('👤 Admin User:');
    const { rows: adminUser } = await pool.query('SELECT email, full_name, role FROM users WHERE email = $1', ['runners.leb@gmail.com']);
    if (adminUser.length > 0) {
      console.log(`✅ Email: ${adminUser[0].email}`);
      console.log(`✅ Name: ${adminUser[0].full_name}`);
      console.log(`✅ Role: ${adminUser[0].role}`);
    } else {
      console.log('❌ Admin user not found');
    }
    console.log('');

    // 2. Verify Exchange Rate
    console.log('💱 Exchange Rate:');
    const { rows: exchangeRate } = await pool.query('SELECT lbp_per_usd FROM exchange_rates ORDER BY effective_at DESC LIMIT 1');
    if (exchangeRate.length > 0) {
      console.log(`✅ LBP/USD: ${exchangeRate[0].lbp_per_usd.toLocaleString()}`);
    } else {
      console.log('❌ Exchange rate not found');
    }
    console.log('');

    // 3. Verify Price List
    console.log('💰 Price List:');
    const { rows: priceList } = await pool.query('SELECT area, fees_lbp, fees_usd FROM price_list ORDER BY area');
    priceList.forEach(price => {
      console.log(`✅ ${price.area}: ${price.fees_lbp.toLocaleString()} LBP (${price.fees_usd} USD)`);
    });
    console.log('');

    // 4. Verify Clients
    console.log('👥 Clients:');
    const { rows: clients } = await pool.query('SELECT business_name, contact_person, category FROM clients ORDER BY business_name');
    clients.forEach(client => {
      console.log(`✅ ${client.business_name} - ${client.contact_person} (${client.category})`);
    });
    console.log('');

    // 5. Verify Drivers
    console.log('🚗 Drivers:');
    const { rows: drivers } = await pool.query('SELECT full_name, phone, active FROM drivers ORDER BY full_name');
    drivers.forEach(driver => {
      console.log(`✅ ${driver.full_name} - ${driver.phone} (${driver.active ? 'Active' : 'Inactive'})`);
    });
    console.log('');

    // 6. Verify Orders
    console.log('📦 Orders:');
    const { rows: orders } = await pool.query(`
      SELECT o.order_ref, o.type, o.customer_name, o.status, o.payment_status, o.total_usd, o.total_lbp, d.full_name as driver_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      ORDER BY o.order_ref
    `);
    orders.forEach(order => {
      console.log(`✅ ${order.order_ref}: ${order.customer_name} - ${order.status} (${order.payment_status}) - $${order.total_usd} / ${order.total_lbp.toLocaleString()} LBP - Driver: ${order.driver_name || 'Unassigned'}`);
    });
    console.log('');

    // 7. Verify Transactions
    console.log('💳 Transactions:');
    const { rows: transactions } = await pool.query('SELECT tx_type, amount_usd, amount_lbp, description FROM transactions ORDER BY created_at');
    transactions.forEach(tx => {
      console.log(`✅ ${tx.tx_type}: $${tx.amount_usd} / ${tx.amount_lbp.toLocaleString()} LBP - ${tx.description}`);
    });
    console.log('');

    // 8. Verify Cashbox
    console.log('💰 Cashbox:');
    const { rows: cashbox } = await pool.query('SELECT balance_usd, balance_lbp FROM cashbox WHERE id = 1');
    if (cashbox.length > 0) {
      console.log(`✅ Balance: $${cashbox[0].balance_usd} / ${cashbox[0].balance_lbp.toLocaleString()} LBP`);
    } else {
      console.log('❌ Cashbox not found');
    }
    console.log('');

    // 9. Summary Statistics
    console.log('📊 Summary Statistics:');
    const { rows: userCount } = await pool.query('SELECT COUNT(*) as count FROM users');
    const { rows: clientCount } = await pool.query('SELECT COUNT(*) as count FROM clients');
    const { rows: driverCount } = await pool.query('SELECT COUNT(*) as count FROM drivers');
    const { rows: orderCount } = await pool.query('SELECT COUNT(*) as count FROM orders');
    const { rows: transactionCount } = await pool.query('SELECT COUNT(*) as count FROM transactions');
    const { rows: priceCount } = await pool.query('SELECT COUNT(*) as count FROM price_list');
    const { rows: cashboxEntryCount } = await pool.query('SELECT COUNT(*) as count FROM cashbox_entries');

    console.log(`✅ Users: ${userCount[0].count}`);
    console.log(`✅ Clients: ${clientCount[0].count}`);
    console.log(`✅ Drivers: ${driverCount[0].count}`);
    console.log(`✅ Orders: ${orderCount[0].count}`);
    console.log(`✅ Transactions: ${transactionCount[0].count}`);
    console.log(`✅ Price List Entries: ${priceCount[0].count}`);
    console.log(`✅ Cashbox Entries: ${cashboxEntryCount[0].count}`);
    console.log('');

    console.log('🎉 Neon database verification completed successfully!');
    console.log('🔑 Login with: runners.leb@gmail.com / 123456789');

  } catch (error) {
    console.error('❌ Error verifying data:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the verification
verifyNeonData().catch(console.error);
