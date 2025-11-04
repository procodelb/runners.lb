const { query, run } = require('../config/database');

async function createAccountingSampleData() {
  console.log('🌱 Creating accounting sample data...');

  try {
    // Wait for database initialization
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      try {
        await query('SELECT 1');
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Database initialization timeout');
        }
        console.log(`⏳ Waiting for database initialization... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Get current timestamp for unique references
    const timestamp = Date.now();
    
    // 1. Create sample clients
    console.log('👥 Creating sample clients...');
    const clients = [
      {
        business_name: `Accounting Test Client ${timestamp}`,
        contact_person: 'Test Contact',
        phone: '+961-1-999999',
        address: 'Test Address, Lebanon',
        client_type: 'BUSINESS',
        old_balance_usd: 100.00,
        old_balance_lbp: 1500000
      }
    ];

    const clientIds = [];
    for (const client of clients) {
      const result = await run(`
        INSERT INTO clients (business_name, contact_person, phone, address, client_type, old_balance_usd, old_balance_lbp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        client.business_name, client.contact_person, client.phone,
        client.address, client.client_type, client.old_balance_usd, client.old_balance_lbp
      ]);
      clientIds.push(result.id);
      console.log(`✅ Created client: ${client.business_name} (ID: ${result.id})`);
    }

    // 2. Create sample customers
    console.log('👤 Creating sample customers...');
    const customers = [
      {
        client_id: clientIds[0],
        name: 'Test Customer',
        phone: '+961-3-888888',
        location: 'Test Location'
      }
    ];

    const customerIds = [];
    for (const customer of customers) {
      const result = await run(`
        INSERT INTO customers (client_id, name, phone, location)
        VALUES (?, ?, ?, ?)
      `, [customer.client_id, customer.name, customer.phone, customer.location]);
      customerIds.push(result.id);
      console.log(`✅ Created customer: ${customer.name} (ID: ${result.id})`);
    }

    // 3. Create sample orders
    console.log('📦 Creating sample orders...');
    const orders = [
      {
        order_ref: `ACC-TEST-${timestamp}-001`,
        type: 'ecommerce',
        client_id: clientIds[0],
        customer_id: customerIds[0],
        deliver_method: 'in_house',
        driver_id: null,
        price_usd: 50.00,
        price_lbp: 0,
        delivery_fee_usd: 3.00,
        delivery_fee_lbp: 0,
        third_party_fee_usd: 0,
        third_party_fee_lbp: 0,
        driver_fee_usd: 2.00,
        driver_fee_lbp: 0,
        total_usd: 55.00,
        total_lbp: 0,
        exchange_rate: 15000,
        status: 'delivered',
        payment_status: 'unpaid',
        notes: 'Accounting test order'
      },
      {
        order_ref: `ACC-TEST-${timestamp}-002`,
        type: 'instant',
        client_id: clientIds[0],
        customer_id: customerIds[0],
        deliver_method: 'third_party',
        driver_id: null,
        price_usd: 25.00,
        price_lbp: 0,
        delivery_fee_usd: 0,
        delivery_fee_lbp: 0,
        third_party_fee_usd: 5.00,
        third_party_fee_lbp: 0,
        driver_fee_usd: 0,
        driver_fee_lbp: 0,
        total_usd: 30.00,
        total_lbp: 0,
        exchange_rate: 15000,
        status: 'completed',
        payment_status: 'paid',
        notes: 'Accounting test instant order'
      }
    ];

    const orderIds = [];
    for (const order of orders) {
      const result = await run(`
        INSERT INTO orders (
          order_ref, type, client_id, customer_id, deliver_method, driver_id,
          price_usd, price_lbp, delivery_fee_usd, delivery_fee_lbp,
          third_party_fee_usd, third_party_fee_lbp, driver_fee_usd, driver_fee_lbp,
          total_usd, total_lbp, exchange_rate, status, payment_status, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.order_ref, order.type, order.client_id, order.customer_id,
        order.deliver_method, order.driver_id, order.price_usd, order.price_lbp,
        order.delivery_fee_usd, order.delivery_fee_lbp, order.third_party_fee_usd,
        order.third_party_fee_lbp, order.driver_fee_usd, order.driver_fee_lbp,
        order.total_usd, order.total_lbp, order.exchange_rate, order.status,
        order.payment_status, order.notes
      ]);
      orderIds.push(result.id);
      console.log(`✅ Created order: ${order.order_ref} (ID: ${result.id})`);
    }

    // 4. Create sample payments
    console.log('💰 Creating sample payments...');
    const payments = [
      {
        order_id: orderIds[1], // Second order
        client_id: clientIds[0],
        amount_usd: 30.00,
        amount_lbp: 0,
        payment_method: 'cash',
        description: 'Payment for instant order',
        reference_number: `PAY-${timestamp}-001`
      }
    ];

    for (const payment of payments) {
      const result = await run(`
        INSERT INTO payments (order_id, client_id, amount_usd, amount_lbp, payment_method, description, reference_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        payment.order_id, payment.client_id, payment.amount_usd, payment.amount_lbp,
        payment.payment_method, payment.description, payment.reference_number
      ]);
      console.log(`✅ Created payment: $${payment.amount_usd} for order ${payment.order_id}`);
    }

    // 5. Create sample exchange rates
    console.log('💱 Creating sample exchange rates...');
    await run(`
      INSERT INTO exchange_rates (lbp_per_usd, effective_at)
      VALUES (?, now())
    `, [15000]);
    console.log(`✅ Created exchange rate: 15000 LBP/USD`);

    console.log('🎉 Accounting sample data creation completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - ${clientIds.length} clients`);
    console.log(`   - ${customerIds.length} customers`);
    console.log(`   - ${orderIds.length} orders`);
    console.log(`   - ${payments.length} payments`);
    console.log(`   - 1 exchange rate`);

    return true;

  } catch (error) {
    console.error('❌ Error creating accounting sample data:', error);
    throw error;
  }
}

module.exports = { createAccountingSampleData };

// Run if called directly
if (require.main === module) {
  createAccountingSampleData()
    .then(() => {
      console.log('✅ Accounting sample data creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Accounting sample data creation failed:', error);
      process.exit(1);
    });
}
