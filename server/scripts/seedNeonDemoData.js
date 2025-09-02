const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Set environment variables for Neon
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.PG_SSL = 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, sslmode: 'require' }
});

async function seedNeonDemoData() {
  console.log('🌱 Seeding Neon database with comprehensive demo data...');

  try {
    await pool.query('SELECT 1 as test');
    console.log('✅ Connected to Neon database');

    // 1. Create Admin User
    console.log('👤 Creating admin user...');
    const adminEmail = 'runners.leb@gmail.com';
    const adminPassword = '123456789';
    
    const { rows: existingUser } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        'INSERT INTO users(email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        [adminEmail, hashedPassword, 'Admin User', 'admin']
      );
      console.log('✅ Admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    const { rows: adminUser } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const adminUserId = adminUser[0].id;

    // 2. Seed Exchange Rate
    console.log('💱 Setting exchange rate...');
    await pool.query('DELETE FROM exchange_rates');
    await pool.query('INSERT INTO exchange_rates(lbp_per_usd) VALUES ($1)', [89000]);
    console.log('✅ Exchange rate set to 89,000 LBP/USD');

    // 3. Seed Price List
    console.log('💰 Seeding price list...');
    await pool.query('DELETE FROM price_list');
    
    const priceListData = [
      { area: 'Beirut', fees_lbp: 200000, fees_usd: 2.25 },
      { area: 'Mount Lebanon', fees_lbp: 250000, fees_usd: 2.81 },
      { area: 'North Lebanon', fees_lbp: 300000, fees_usd: 3.37 },
      { area: 'South Lebanon', fees_lbp: 300000, fees_usd: 3.37 },
      { area: 'Bekaa', fees_lbp: 350000, fees_usd: 3.93 },
      { area: 'Nabatieh', fees_lbp: 350000, fees_usd: 3.93 }
    ];

    for (const price of priceListData) {
      await pool.query(
        'INSERT INTO price_list(country, area, fees_lbp, fees_usd) VALUES ($1, $2, $3, $4)',
        ['Lebanon', price.area, price.fees_lbp, price.fees_usd]
      );
    }
    console.log('✅ Price list seeded');

    // 4. Seed Clients
    console.log('👥 Seeding clients...');
    await pool.query('DELETE FROM clients');
    
    const clientsData = [
      { business_name: 'Tech Solutions Lebanon', contact_person: 'Ahmad Al-Rashid', phone: '+961 70 123 456', address: 'Hamra Street, Beirut', instagram: '@techsolutionslb', website: 'www.techsolutionslb.com', category: 'Technology' },
      { business_name: 'Lebanese Fashion House', contact_person: 'Sarah Mansour', phone: '+961 71 234 567', address: 'Gemmayze, Beirut', instagram: '@lebanesefashion', website: 'www.lebanesefashion.com', category: 'Fashion' },
      { business_name: 'Cedar Restaurant', contact_person: 'Omar Khalil', phone: '+961 76 345 678', address: 'Achrafieh, Beirut', instagram: '@cedarrestaurant', website: 'www.cedarrestaurant.com', category: 'Restaurant' },
      { business_name: 'Beirut Electronics', contact_person: 'Nadia Fares', phone: '+961 78 456 789', address: 'Bourj Hammoud, Beirut', instagram: '@beirutelectronics', website: 'www.beirutelectronics.com', category: 'Electronics' },
      { business_name: 'Mountain View Hotel', contact_person: 'George Abou Chakra', phone: '+961 79 567 890', address: 'Faraya, Mount Lebanon', instagram: '@mountainviewhotel', website: 'www.mountainviewhotel.com', category: 'Hospitality' }
    ];

    for (const client of clientsData) {
      await pool.query(
        'INSERT INTO clients(business_name, contact_person, phone, address, instagram, website, category) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [client.business_name, client.contact_person, client.phone, client.address, client.instagram, client.website, client.category]
      );
    }
    console.log('✅ Clients seeded');

    // 5. Seed Drivers
    console.log('🚗 Seeding drivers...');
    await pool.query('DELETE FROM drivers');
    
    const driversData = [
      { full_name: 'Hassan Al-Zein', phone: '+961 70 111 111', address: 'Bourj Hammoud, Beirut', notes: 'Reliable driver, works night shifts', active: true, default_fee_lbp: 50000, default_fee_usd: 0.56 },
      { full_name: 'Mohammed Saad', phone: '+961 71 222 222', address: 'Achrafieh, Beirut', notes: 'Experienced driver, good with fragile items', active: true, default_fee_lbp: 60000, default_fee_usd: 0.67 },
      { full_name: 'Ali Mansour', phone: '+961 76 333 333', address: 'Hamra, Beirut', notes: 'Fast delivery, works weekends', active: true, default_fee_lbp: 55000, default_fee_usd: 0.62 },
      { full_name: 'Karim Fares', phone: '+961 78 444 444', address: 'Gemmayze, Beirut', notes: 'New driver, learning routes', active: true, default_fee_lbp: 45000, default_fee_usd: 0.51 },
      { full_name: 'Samir Khalil', phone: '+961 79 555 555', address: 'Ras Beirut, Beirut', notes: 'Senior driver, handles VIP clients', active: true, default_fee_lbp: 70000, default_fee_usd: 0.79 }
    ];

    for (const driver of driversData) {
      await pool.query(
        'INSERT INTO drivers(full_name, phone, address, notes, active, default_fee_lbp, default_fee_usd) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [driver.full_name, driver.phone, driver.address, driver.notes, driver.active, driver.default_fee_lbp, driver.default_fee_usd]
      );
    }
    console.log('✅ Drivers seeded');

    const { rows: drivers } = await pool.query('SELECT id FROM drivers ORDER BY id');
    const driverIds = drivers.map(d => d.id);

    // 6. Seed Orders
    console.log('📦 Seeding orders...');
    await pool.query('DELETE FROM orders');
    
    const ordersData = [
      { order_ref: 'ORD-2024-001', type: 'ecommerce', customer_phone: '+961 70 123 456', customer_name: 'Ahmad Al-Rashid', customer_address: 'Hamra Street, Beirut', brand_name: 'Tech Solutions Lebanon', deliver_method: 'in_house', driver_id: driverIds[0], driver_fee_usd: 0.56, driver_fee_lbp: 50000, status: 'completed', payment_status: 'paid', total_usd: 25.50, total_lbp: 2269500, delivery_fee_usd: 2.25, delivery_fee_lbp: 200000, notes: 'Electronics delivery - fragile items' },
      { order_ref: 'ORD-2024-002', type: 'instant', customer_phone: '+961 71 234 567', customer_name: 'Sarah Mansour', customer_address: 'Gemmayze, Beirut', brand_name: 'Lebanese Fashion House', deliver_method: 'third_party', third_party_name: 'Express Delivery', third_party_fee_usd: 1.50, third_party_fee_lbp: 133500, driver_id: driverIds[1], driver_fee_usd: 0.67, driver_fee_lbp: 60000, status: 'in_transit', payment_status: 'partial', total_usd: 45.75, total_lbp: 4071750, delivery_fee_usd: 2.81, delivery_fee_lbp: 250000, notes: 'Fashion items - handle with care' },
      { order_ref: 'ORD-2024-003', type: 'go_to_market', customer_phone: '+961 76 345 678', customer_name: 'Omar Khalil', customer_address: 'Achrafieh, Beirut', brand_name: 'Cedar Restaurant', deliver_method: 'in_house', driver_id: driverIds[2], driver_fee_usd: 0.62, driver_fee_lbp: 55000, status: 'delivered', payment_status: 'paid', total_usd: 15.25, total_lbp: 1357250, delivery_fee_usd: 2.25, delivery_fee_lbp: 200000, notes: 'Food delivery - keep hot' },
      { order_ref: 'ORD-2024-004', type: 'ecommerce', customer_phone: '+961 78 456 789', customer_name: 'Nadia Fares', customer_address: 'Bourj Hammoud, Beirut', brand_name: 'Beirut Electronics', deliver_method: 'third_party', third_party_name: 'Secure Logistics', third_party_fee_usd: 2.00, third_party_fee_lbp: 178000, driver_id: driverIds[3], driver_fee_usd: 0.51, driver_fee_lbp: 45000, status: 'assigned', payment_status: 'unpaid', total_usd: 125.00, total_lbp: 11125000, delivery_fee_usd: 2.25, delivery_fee_lbp: 200000, notes: 'High-value electronics - signature required' },
      { order_ref: 'ORD-2024-005', type: 'instant', customer_phone: '+961 79 567 890', customer_name: 'George Abou Chakra', customer_address: 'Faraya, Mount Lebanon', brand_name: 'Mountain View Hotel', deliver_method: 'in_house', driver_id: driverIds[4], driver_fee_usd: 0.79, driver_fee_lbp: 70000, status: 'new', payment_status: 'unpaid', total_usd: 35.50, total_lbp: 3159500, delivery_fee_usd: 2.81, delivery_fee_lbp: 250000, notes: 'Hotel supplies delivery' }
    ];

    for (const order of ordersData) {
      await pool.query(
        `INSERT INTO orders(order_ref, type, customer_phone, customer_name, customer_address, brand_name, deliver_method, third_party_name, third_party_fee_usd, third_party_fee_lbp, driver_id, driver_fee_usd, driver_fee_lbp, status, payment_status, total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [order.order_ref, order.type, order.customer_phone, order.customer_name, order.customer_address, order.brand_name, order.deliver_method, order.third_party_name, order.third_party_fee_usd, order.third_party_fee_lbp, order.driver_id, order.driver_fee_usd, order.driver_fee_lbp, order.status, order.payment_status, order.total_usd, order.total_lbp, order.delivery_fee_usd, order.delivery_fee_lbp, order.notes, adminUserId]
      );
    }
    console.log('✅ Orders seeded');

    // 7. Seed Transactions
    console.log('💳 Seeding transactions...');
    await pool.query('DELETE FROM transactions');
    
    const { rows: orders } = await pool.query('SELECT id, order_ref, total_usd, total_lbp FROM orders ORDER BY id');
    
    const transactionsData = [
      { tx_type: 'order_payment', amount_usd: 25.50, amount_lbp: 2269500, description: 'Payment for order ORD-2024-001', actor_type: 'client', actor_id: 1, debit_account: 'cash', credit_account: 'revenue', order_id: orders[0].id },
      { tx_type: 'order_payment', amount_usd: 22.50, amount_lbp: 2002500, description: 'Partial payment for order ORD-2024-002', actor_type: 'client', actor_id: 2, debit_account: 'cash', credit_account: 'revenue', order_id: orders[1].id },
      { tx_type: 'order_payment', amount_usd: 15.25, amount_lbp: 1357250, description: 'Payment for order ORD-2024-003', actor_type: 'client', actor_id: 3, debit_account: 'cash', credit_account: 'revenue', order_id: orders[2].id },
      { tx_type: 'driver_payment', amount_usd: 0.56, amount_lbp: 50000, description: 'Driver fee for order ORD-2024-001', actor_type: 'driver', actor_id: driverIds[0], debit_account: 'driver_expenses', credit_account: 'cash', order_id: orders[0].id },
      { tx_type: 'driver_payment', amount_usd: 0.67, amount_lbp: 60000, description: 'Driver fee for order ORD-2024-002', actor_type: 'driver', actor_id: driverIds[1], debit_account: 'driver_expenses', credit_account: 'cash', order_id: orders[1].id },
      { tx_type: 'third_party_payment', amount_usd: 1.50, amount_lbp: 133500, description: 'Third party fee for order ORD-2024-002', actor_type: 'third_party', actor_id: 1, debit_account: 'third_party_expenses', credit_account: 'cash', order_id: orders[1].id }
    ];

    for (const transaction of transactionsData) {
      await pool.query(
        `INSERT INTO transactions(tx_type, amount_usd, amount_lbp, description, actor_type, actor_id, debit_account, credit_account, order_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [transaction.tx_type, transaction.amount_usd, transaction.amount_lbp, transaction.description, transaction.actor_type, transaction.actor_id, transaction.debit_account, transaction.credit_account, transaction.order_id, adminUserId]
      );
    }
    console.log('✅ Transactions seeded');

    // 8. Seed Cashbox
    console.log('💰 Seeding cashbox...');
    await pool.query('DELETE FROM cashbox');
    await pool.query('DELETE FROM cashbox_entries');
    
    await pool.query('INSERT INTO cashbox(id, balance_usd, balance_lbp) VALUES (1, 0, 0)');

    const cashboxEntriesData = [
      { entry_type: 'cash_in', amount_usd: 25.50, amount_lbp: 2269500, description: 'Payment received for order ORD-2024-001', actor_type: 'client', actor_id: 1 },
      { entry_type: 'cash_in', amount_usd: 22.50, amount_lbp: 2002500, description: 'Partial payment received for order ORD-2024-002', actor_type: 'client', actor_id: 2 },
      { entry_type: 'cash_in', amount_usd: 15.25, amount_lbp: 1357250, description: 'Payment received for order ORD-2024-003', actor_type: 'client', actor_id: 3 },
      { entry_type: 'cash_out', amount_usd: 0.56, amount_lbp: 50000, description: 'Driver payment for order ORD-2024-001', actor_type: 'driver', actor_id: driverIds[0] },
      { entry_type: 'cash_out', amount_usd: 0.67, amount_lbp: 60000, description: 'Driver payment for order ORD-2024-002', actor_type: 'driver', actor_id: driverIds[1] },
      { entry_type: 'cash_out', amount_usd: 1.50, amount_lbp: 133500, description: 'Third party payment for order ORD-2024-002', actor_type: 'third_party', actor_id: 1 }
    ];

    for (const entry of cashboxEntriesData) {
      await pool.query(
        `INSERT INTO cashbox_entries(entry_type, amount_usd, amount_lbp, description, actor_type, actor_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entry.entry_type, entry.amount_usd, entry.amount_lbp, entry.description, entry.actor_type, entry.actor_id, adminUserId]
      );
    }

    const netUsd = 63.25 - 2.73; // Total income - total expenses
    const netLbp = 5629250 - 243500; // Total income - total expenses
    
    await pool.query('UPDATE cashbox SET balance_usd = $1, balance_lbp = $2 WHERE id = 1', [netUsd, netLbp]);
    console.log('✅ Cashbox seeded');

    // 9. Display Summary
    console.log('\n📊 Demo Data Summary:');
    console.log('=====================');
    
    const { rows: userCount } = await pool.query('SELECT COUNT(*) as count FROM users');
    const { rows: clientCount } = await pool.query('SELECT COUNT(*) as count FROM clients');
    const { rows: driverCount } = await pool.query('SELECT COUNT(*) as count FROM drivers');
    const { rows: orderCount } = await pool.query('SELECT COUNT(*) as count FROM orders');
    const { rows: transactionCount } = await pool.query('SELECT COUNT(*) as count FROM transactions');
    const { rows: priceCount } = await pool.query('SELECT COUNT(*) as count FROM price_list');
    
    console.log(`👤 Users: ${userCount[0].count}`);
    console.log(`👥 Clients: ${clientCount[0].count}`);
    console.log(`🚗 Drivers: ${driverCount[0].count}`);
    console.log(`📦 Orders: ${orderCount[0].count}`);
    console.log(`💳 Transactions: ${transactionCount[0].count}`);
    console.log(`💰 Price List Entries: ${priceCount[0].count}`);
    
    console.log('\n🔑 Admin Credentials:');
    console.log('Email: runners.leb@gmail.com');
    console.log('Password: 123456789');
    
    console.log('\n✅ Neon database successfully seeded with comprehensive demo data!');
    console.log('🚀 Your ERP system is ready for testing and development.');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the seeding
seedNeonDemoData().catch(console.error);