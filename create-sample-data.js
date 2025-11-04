const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createSampleData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creating sample data for Dashboard and Reports...\n');
    
    // 1. Create sample clients
    console.log('1️⃣ Creating sample clients...');
    const clients = [
      { business_name: 'ABC Restaurant', phone: '+961-1-234567', email: 'abc@restaurant.com', address: 'Hamra, Beirut' },
      { business_name: 'XYZ Cafe', phone: '+961-1-345678', email: 'xyz@cafe.com', address: 'Verdun, Beirut' },
      { business_name: 'Fresh Market', phone: '+961-1-456789', email: 'fresh@market.com', address: 'Ashrafieh, Beirut' },
      { business_name: 'Quick Delivery', phone: '+961-1-567890', email: 'quick@delivery.com', address: 'Sin El Fil, Beirut' },
      { business_name: 'Gourmet Kitchen', phone: '+961-1-678901', email: 'gourmet@kitchen.com', address: 'Gemmayze, Beirut' }
    ];
    
    const clientIds = [];
    for (const clientData of clients) {
      const result = await client.query(`
        INSERT INTO clients (business_name, phone, email, address, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        ON CONFLICT (email) DO UPDATE SET business_name = EXCLUDED.business_name
        RETURNING id
      `, [clientData.business_name, clientData.phone, clientData.email, clientData.address]);
      clientIds.push(result.rows[0].id);
    }
    console.log(`✅ Created ${clientIds.length} sample clients`);
    
    // 2. Create sample drivers
    console.log('2️⃣ Creating sample drivers...');
    const drivers = [
      { full_name: 'Ahmad Hassan', phone: '+961-70-123456', email: 'ahmad@driver.com', vehicle_type: 'motorcycle' },
      { full_name: 'Mohammed Ali', phone: '+961-70-234567', email: 'mohammed@driver.com', vehicle_type: 'car' },
      { full_name: 'Omar Khoury', phone: '+961-70-345678', email: 'omar@driver.com', vehicle_type: 'motorcycle' },
      { full_name: 'Hassan Saad', phone: '+961-70-456789', email: 'hassan@driver.com', vehicle_type: 'car' }
    ];
    
    const driverIds = [];
    for (const driverData of drivers) {
      const result = await client.query(`
        INSERT INTO drivers (full_name, phone, email, vehicle_type, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, now(), now())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
      `, [driverData.full_name, driverData.phone, driverData.email, driverData.vehicle_type]);
      driverIds.push(result.rows[0].id);
    }
    console.log(`✅ Created ${driverIds.length} sample drivers`);
    
    // 3. Create sample orders with realistic data
    console.log('3️⃣ Creating sample orders...');
    const orderTypes = ['delivery', 'pickup', 'dine_in'];
    const deliveryMethods = ['in_house', 'third_party'];
    const paymentStatuses = ['paid', 'unpaid', 'partial'];
    const orderStatuses = ['new', 'pending', 'in_progress', 'completed', 'cancelled'];
    
    const orders = [];
    const today = new Date();
    
    // Create orders for the last 30 days
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const orderDate = new Date(today.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];
      const driverId = driverIds[Math.floor(Math.random() * driverIds.length)];
      const orderType = orderTypes[Math.floor(Math.random() * orderTypes.length)];
      const deliveryMethod = deliveryMethods[Math.floor(Math.random() * deliveryMethods.length)];
      const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const orderStatus = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      
      // Generate realistic prices
      const totalUsd = Math.floor(Math.random() * 50) + 10; // $10-$60
      const totalLbp = totalUsd * 89000; // Convert to LBP
      const deliveryFeeUsd = Math.floor(Math.random() * 10) + 2; // $2-$12
      const deliveryFeeLbp = deliveryFeeUsd * 89000;
      const driverFeeUsd = Math.floor(Math.random() * 5) + 1; // $1-$6
      const driverFeeLbp = driverFeeUsd * 89000;
      
      const order = {
        order_ref: `ORD-${String(i + 1).padStart(4, '0')}`,
        client_id: clientId,
        driver_id: driverId,
        order_type: orderType,
        deliver_method: deliveryMethod,
        customer_name: `Customer ${i + 1}`,
        customer_phone: `+961-70-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        customer_address: `Address ${i + 1}, Beirut`,
        total_usd: totalUsd,
        total_lbp: totalLbp,
        delivery_fee_usd: deliveryFeeUsd,
        delivery_fee_lbp: deliveryFeeLbp,
        driver_fee_usd: driverFeeUsd,
        driver_fee_lbp: driverFeeLbp,
        payment_status: paymentStatus,
        status: orderStatus,
        created_at: orderDate.toISOString(),
        updated_at: orderDate.toISOString()
      };
      
      orders.push(order);
    }
    
    // Insert orders
    for (const order of orders) {
      await client.query(`
        INSERT INTO orders (
          order_ref, client_id, driver_id, order_type, deliver_method,
          customer_name, customer_phone, customer_address,
          total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp,
          driver_fee_usd, driver_fee_lbp, payment_status, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (order_ref) DO NOTHING
      `, [
        order.order_ref, order.client_id, order.driver_id, order.order_type, order.deliver_method,
        order.customer_name, order.customer_phone, order.customer_address,
        order.total_usd, order.total_lbp, order.delivery_fee_usd, order.delivery_fee_lbp,
        order.driver_fee_usd, order.driver_fee_lbp, order.payment_status, order.status,
        order.created_at, order.updated_at
      ]);
    }
    console.log(`✅ Created ${orders.length} sample orders`);
    
    // 4. Create sample transactions
    console.log('4️⃣ Creating sample transactions...');
    const transactionTypes = ['income', 'expense'];
    const categories = ['delivery_fee', 'driver_payment', 'office_supplies', 'fuel', 'maintenance'];
    
    const transactions = [];
    for (let i = 0; i < 30; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const transactionDate = new Date(today.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const amountUsd = Math.floor(Math.random() * 100) + 10; // $10-$110
      const amountLbp = amountUsd * 89000;
      
      const transaction = {
        type: type,
        category: category,
        amount_usd: amountUsd,
        amount_lbp: amountLbp,
        description: `${type === 'income' ? 'Income' : 'Expense'} - ${category}`,
        created_at: transactionDate.toISOString(),
        updated_at: transactionDate.toISOString()
      };
      
      transactions.push(transaction);
    }
    
    // Insert transactions
    for (const transaction of transactions) {
      await client.query(`
        INSERT INTO transactions (
          type, category, amount_usd, amount_lbp, description, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        transaction.type, transaction.category, transaction.amount_usd, transaction.amount_lbp,
        transaction.description, transaction.created_at, transaction.updated_at
      ]);
    }
    console.log(`✅ Created ${transactions.length} sample transactions`);
    
    // 5. Create sample cashbox data
    console.log('5️⃣ Creating sample cashbox data...');
    await client.query(`
      INSERT INTO cashbox (
        id, balance_usd, balance_lbp, initial_capital_usd, initial_capital_lbp,
        cash_balance_usd, cash_balance_lbp, wish_balance_usd, wish_balance_lbp,
        created_at, updated_at
      ) VALUES (
        1, 5000, 445000000, 10000, 890000000, 3000, 267000000, 2000, 178000000,
        now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        balance_usd = EXCLUDED.balance_usd,
        balance_lbp = EXCLUDED.balance_lbp,
        updated_at = now()
    `);
    console.log('✅ Created sample cashbox data');
    
    // 6. Create sample cashbox entries
    console.log('6️⃣ Creating sample cashbox entries...');
    const entryTypes = ['income', 'expense', 'transfer', 'capital_adjustment'];
    
    for (let i = 0; i < 20; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const entryDate = new Date(today.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      const entryType = entryTypes[Math.floor(Math.random() * entryTypes.length)];
      const amountUsd = Math.floor(Math.random() * 200) + 10; // $10-$210
      const amountLbp = amountUsd * 89000;
      
      await client.query(`
        INSERT INTO cashbox_entries (
          entry_type, amount_usd, amount_lbp, description, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        entryType, amountUsd, amountLbp, `Sample ${entryType} entry`, entryDate.toISOString()
      ]);
    }
    console.log('✅ Created sample cashbox entries');
    
    console.log('\n🎉 Sample data creation completed successfully!');
    console.log('\n📊 Dashboard and Reports now have realistic data:');
    console.log(`   • ${clientIds.length} clients`);
    console.log(`   • ${driverIds.length} drivers`);
    console.log(`   • ${orders.length} orders`);
    console.log(`   • ${transactions.length} transactions`);
    console.log(`   • Cashbox with $5,000 USD balance`);
    console.log('\n🚀 You can now view realistic data in Dashboard and Reports pages!');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createSampleData();
