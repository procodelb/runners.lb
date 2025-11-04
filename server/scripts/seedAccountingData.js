const { query, run } = require('../config/database');

async function seedAccountingData() {
  console.log('🌱 Seeding accounting sample data...');

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

    // 1. Create sample clients
    console.log('👥 Creating sample clients...');
    const clients = [
      {
        business_name: 'Shop A Trading',
        contact_person: 'Ahmed Hassan',
        phone: '+961-1-123456',
        address: 'Beirut, Lebanon',
        client_type: 'BUSINESS',
        old_balance_usd: 0,
        old_balance_lbp: 0
      },
      {
        business_name: 'John Doe',
        contact_person: 'John Doe',
        phone: '+961-3-987654',
        address: 'Tripoli, Lebanon',
        client_type: 'INDIVIDUAL',
        old_balance_usd: 0,
        old_balance_lbp: 0
      },
      {
        business_name: 'Restaurant B LLC',
        contact_person: 'Maria Rodriguez',
        phone: '+961-1-555555',
        address: 'Jounieh, Lebanon',
        client_type: 'BUSINESS',
        old_balance_usd: 0,
        old_balance_lbp: 0
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

    // 2. Create sample customers (receivers)
    console.log('👤 Creating sample customers...');
    const customers = [
      {
        client_id: clientIds[0],
        name: 'Ahmed Hassan',
        phone: '+961-3-111111',
        location: 'Hamra, Beirut'
      },
      {
        client_id: clientIds[0],
        name: 'Sara Khoury',
        phone: '+961-3-222222',
        location: 'Verdun, Beirut'
      },
      {
        client_id: clientIds[1],
        name: 'John Doe',
        phone: '+961-3-987654',
        location: 'Tripoli, Lebanon'
      },
      {
        client_id: clientIds[2],
        name: 'Maria Rodriguez',
        phone: '+961-3-333333',
        location: 'Jounieh, Lebanon'
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

    // 3. Create sample drivers
    console.log('🚚 Creating sample drivers...');
    const drivers = [
      {
        full_name: 'Ali Ahmad',
        phone: '+961-3-444444',
        address: 'Beirut, Lebanon',
        active: true,
        default_fee_usd: 5.00,
        default_fee_lbp: 75000,
        account_balance_usd: 0,
        account_balance_lbp: 0
      },
      {
        full_name: 'Omar Khalil',
        phone: '+961-3-555555',
        address: 'Tripoli, Lebanon',
        active: true,
        default_fee_usd: 4.50,
        default_fee_lbp: 67500,
        account_balance_usd: 0,
        account_balance_lbp: 0
      }
    ];

    const driverIds = [];
    for (const driver of drivers) {
      const result = await run(`
        INSERT INTO drivers (full_name, phone, address, active, default_fee_usd, default_fee_lbp, account_balance_usd, account_balance_lbp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        driver.full_name, driver.phone, driver.address, driver.active,
        driver.default_fee_usd, driver.default_fee_lbp, driver.account_balance_usd, driver.account_balance_lbp
      ]);
      driverIds.push(result.id);
      console.log(`✅ Created driver: ${driver.full_name} (ID: ${result.id})`);
    }

    // 4. Create sample third parties
    console.log('🏢 Creating sample third parties...');
    const thirdParties = [
      {
        name: 'Express Delivery Co.',
        contact_person: 'Manager',
        contact_phone: '+961-1-666666',
        email: 'express@example.com',
        commission_rate: 0.15,
        active: true
      },
      {
        name: 'Fast Logistics',
        contact_person: 'Operations Manager',
        contact_phone: '+961-1-777777',
        email: 'fast@example.com',
        commission_rate: 0.12,
        active: true
      }
    ];

    const thirdPartyIds = [];
    for (const thirdParty of thirdParties) {
      // Check if third party already exists
      const existing = await query('SELECT id FROM third_parties WHERE name = ?', [thirdParty.name]);
      if (existing.length > 0) {
        thirdPartyIds.push(existing[0].id);
        console.log(`✅ Using existing third party: ${thirdParty.name} (ID: ${existing[0].id})`);
      } else {
        const result = await run(`
          INSERT INTO third_parties (name, contact_person, contact_phone, email, commission_rate, active)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          thirdParty.name, thirdParty.contact_person, thirdParty.contact_phone,
          thirdParty.email, thirdParty.commission_rate, thirdParty.active
        ]);
        thirdPartyIds.push(result.id);
        console.log(`✅ Created third party: ${thirdParty.name} (ID: ${result.id})`);
      }
    }

    // 5. Create sample orders
    console.log('📦 Creating sample orders...');
    const orders = [
      {
        order_ref: 'ORD-1001',
        type: 'ecommerce',
        client_id: clientIds[0],
        customer_id: customerIds[0],
        deliver_method: 'in_house',
        driver_id: driverIds[0],
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
        notes: 'E-commerce order for Shop A'
      },
      {
        order_ref: 'ORD-1002',
        type: 'instant',
        client_id: clientIds[1],
        customer_id: customerIds[2],
        deliver_method: 'third_party',
        driver_id: driverIds[1],
        price_usd: 20.00,
        price_lbp: 0,
        delivery_fee_usd: 0,
        delivery_fee_lbp: 0,
        third_party_fee_usd: 4.00,
        third_party_fee_lbp: 0,
        driver_fee_usd: 0,
        driver_fee_lbp: 0,
        total_usd: 24.00,
        total_lbp: 0,
        exchange_rate: 15000,
        status: 'completed',
        payment_status: 'prepaid',
        notes: 'Instant order for John Doe'
      },
      {
        order_ref: 'ORD-1003',
        type: 'go_to_market',
        client_id: clientIds[2],
        customer_id: customerIds[3],
        deliver_method: 'in_house',
        driver_id: driverIds[0],
        price_usd: 75.00,
        price_lbp: 0,
        delivery_fee_usd: 5.00,
        delivery_fee_lbp: 0,
        third_party_fee_usd: 0,
        third_party_fee_lbp: 0,
        driver_fee_usd: 3.00,
        driver_fee_lbp: 0,
        total_usd: 83.00,
        total_lbp: 0,
        exchange_rate: 15000,
        status: 'delivered',
        payment_status: 'unpaid',
        notes: 'Go-to-market order for Restaurant B'
      },
      {
        order_ref: 'ORD-1004',
        type: 'ecommerce',
        client_id: clientIds[0],
        customer_id: customerIds[1],
        deliver_method: 'third_party',
        driver_id: null,
        price_usd: 30.00,
        price_lbp: 0,
        delivery_fee_usd: 0,
        delivery_fee_lbp: 0,
        third_party_fee_usd: 6.00,
        third_party_fee_lbp: 0,
        driver_fee_usd: 0,
        driver_fee_lbp: 0,
        total_usd: 36.00,
        total_lbp: 0,
        exchange_rate: 15000,
        status: 'new',
        payment_status: 'unpaid',
        notes: 'E-commerce order with third party delivery'
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

    // 6. Create sample payments
    console.log('💰 Creating sample payments...');
    const payments = [
      {
        order_id: orderIds[1], // ORD-1002
        client_id: clientIds[1],
        amount_usd: 24.00,
        amount_lbp: 0,
        payment_method: 'cash',
        description: 'Prepaid payment for instant order',
        reference_number: 'PAY-001'
      },
      {
        order_id: orderIds[0], // ORD-1001
        client_id: clientIds[0],
        amount_usd: 30.00,
        amount_lbp: 0,
        payment_method: 'card',
        description: 'Partial payment for e-commerce order',
        reference_number: 'PAY-002'
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

    // 7. Create sample exchange rates
    console.log('💱 Creating sample exchange rates...');
    const exchangeRates = [
      { date: '2025-09-20', usd_to_lbp_rate: 15000 },
      { date: '2025-09-21', usd_to_lbp_rate: 15100 },
      { date: '2025-09-22', usd_to_lbp_rate: 15050 },
      { date: '2025-09-23', usd_to_lbp_rate: 15200 },
      { date: '2025-09-24', usd_to_lbp_rate: 15150 }
    ];

    for (const rate of exchangeRates) {
      await run(`
        INSERT INTO exchange_rates (date, usd_to_lbp_rate)
        VALUES (?, ?)
        ON CONFLICT (date) DO UPDATE SET usd_to_lbp_rate = EXCLUDED.usd_to_lbp_rate
      `, [rate.date, rate.usd_to_lbp_rate]);
      console.log(`✅ Created exchange rate: ${rate.date} = ${rate.usd_to_lbp_rate} LBP/USD`);
    }

    // 8. Update order totals
    console.log('🧮 Updating order totals...');
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const totalUsd = order.price_usd + order.delivery_fee_usd + order.third_party_fee_usd;
      const totalLbp = Math.round(totalUsd * order.exchange_rate);
      
      await run(`
        UPDATE orders 
        SET total_order_value_usd = ?, total_order_value_lbp = ?
        WHERE id = ?
      `, [totalUsd, totalLbp, orderIds[i]]);
      
      console.log(`✅ Updated totals for ${order.order_ref}: $${totalUsd} / ${totalLbp} LBP`);
    }

    console.log('🎉 Accounting sample data seeding completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - ${clientIds.length} clients`);
    console.log(`   - ${customerIds.length} customers`);
    console.log(`   - ${driverIds.length} drivers`);
    console.log(`   - ${thirdPartyIds.length} third parties`);
    console.log(`   - ${orderIds.length} orders`);
    console.log(`   - ${payments.length} payments`);
    console.log(`   - ${exchangeRates.length} exchange rates`);

    return true;

  } catch (error) {
    console.error('❌ Error seeding accounting data:', error);
    throw error;
  }
}

module.exports = { seedAccountingData };

// Run if called directly
if (require.main === module) {
  seedAccountingData()
    .then(() => {
      console.log('✅ Accounting data seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Accounting data seeding failed:', error);
      process.exit(1);
    });
}
