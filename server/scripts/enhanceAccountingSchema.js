const { query, run } = require('../config/database');

async function enhanceAccountingSchema() {
  console.log('🔧 Enhancing database schema for comprehensive accounting module...');
  
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

  try {
    // 1. Create clients table with proper structure
    console.log('📋 Creating clients table...');
    await run(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('BUSINESS', 'INDIVIDUAL')),
        name TEXT NOT NULL,
        business_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        address TEXT,
        default_currency TEXT DEFAULT 'USD' CHECK (default_currency IN ('USD', 'LBP')),
        account_balance_usd NUMERIC(12,2) DEFAULT 0,
        account_balance_lbp BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 2. Create customers table (receivers)
    console.log('📋 Creating customers table...');
    await run(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT,
        location TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 3. Enhance orders table with accounting fields
    console.log('📋 Enhancing orders table...');
    await run(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS price_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS price_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_order_value_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_order_value_lbp BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS date_created TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS date_delivered TIMESTAMPTZ
    `);

    // 4. Create third_parties table
    console.log('📋 Creating third_parties table...');
    await run(`
      CREATE TABLE IF NOT EXISTS third_parties (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        contact_email TEXT,
        account_balance_usd NUMERIC(12,2) DEFAULT 0,
        account_balance_lbp BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 5. Enhance drivers table with account balances
    console.log('📋 Enhancing drivers table...');
    await run(`
      ALTER TABLE drivers 
      ADD COLUMN IF NOT EXISTS account_balance_usd NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS account_balance_lbp BIGINT DEFAULT 0
    `);

    // 6. Create payments table
    console.log('📋 Creating payments table...');
    await run(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        account_type TEXT NOT NULL CHECK (account_type IN ('client', 'driver', 'third_party', 'cashbox')),
        account_id INTEGER NOT NULL,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'online', 'bank_transfer')),
        date TIMESTAMPTZ DEFAULT now(),
        note TEXT,
        reconciled BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 7. Create cashbox_entries table
    console.log('📋 Creating cashbox_entries table...');
    await run(`
      CREATE TABLE IF NOT EXISTS cashbox_entries (
        id SERIAL PRIMARY KEY,
        cashbox_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        reference_id INTEGER,
        reference_table TEXT,
        note TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        date TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 8. Create driver_advances table
    console.log('📋 Creating driver_advances table...');
    await run(`
      CREATE TABLE IF NOT EXISTS driver_advances (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared')),
        created_at TIMESTAMPTZ DEFAULT now(),
        cleared_at TIMESTAMPTZ
      )
    `);

    // 9. Create account_adjustments table
    console.log('📋 Creating account_adjustments table...');
    await run(`
      CREATE TABLE IF NOT EXISTS account_adjustments (
        id SERIAL PRIMARY KEY,
        account_type TEXT NOT NULL CHECK (account_type IN ('client', 'driver', 'third_party')),
        account_id INTEGER NOT NULL,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        reason TEXT NOT NULL,
        date TIMESTAMPTZ DEFAULT now(),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 10. Create exchange_rates table
    console.log('📋 Creating exchange_rates table...');
    await run(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        usd_to_lbp_rate NUMERIC(18,6) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(date)
      )
    `);

    // 11. Create audit_log table for tracking changes
    console.log('📋 Creating audit_log table...');
    await run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
        old_values JSONB,
        new_values JSONB,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 12. Create indexes for performance
    await createAccountingIndexes();

    console.log('✅ Accounting schema enhancement completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Error enhancing accounting schema:', error);
    throw error;
  }
}

async function createAccountingIndexes() {
  console.log('📊 Creating accounting indexes...');
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_date_created ON orders(date_created)',
    'CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_payments_account_type_id ON payments(account_type, account_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)',
    'CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_cashbox_entries_date ON cashbox_entries(date)',
    'CREATE INDEX IF NOT EXISTS idx_driver_advances_driver_id ON driver_advances(driver_id)',
    'CREATE INDEX IF NOT EXISTS idx_driver_advances_status ON driver_advances(status)',
    'CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at)'
  ];

  for (const indexSql of indexes) {
    try {
      await run(indexSql);
    } catch (error) {
      console.warn(`⚠️  Index creation warning: ${error.message}`);
    }
  }
}

// Function to calculate order totals
async function calculateOrderTotals(orderId) {
  try {
    const order = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order.length) return null;

    const o = order[0];
    const totalUsd = Number(o.price_usd || 0) + Number(o.delivery_fee_usd || 0) + Number(o.third_party_fee_usd || 0);
    const totalLbp = Number(o.price_lbp || 0) + Number(o.delivery_fee_lbp || 0) + Number(o.third_party_fee_lbp || 0);

    await run(`
      UPDATE orders 
      SET total_order_value_usd = ?, total_order_value_lbp = ?
      WHERE id = ?
    `, [totalUsd, totalLbp, orderId]);

    return { totalUsd, totalLbp };
  } catch (error) {
    console.error('Error calculating order totals:', error);
    throw error;
  }
}

// Function to handle order status change to delivered
async function handleOrderDelivered(orderId) {
  try {
    const order = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order.length) return;

    const o = order[0];
    
    // Update driver balance if in-house delivery
    if (o.deliver_method === 'in_house' && o.driver_id && o.driver_fee_usd > 0) {
      await run(`
        UPDATE drivers 
        SET account_balance_usd = account_balance_usd + ?, 
            account_balance_lbp = account_balance_lbp + ?
        WHERE id = ?
      `, [o.driver_fee_usd, o.driver_fee_lbp, o.driver_id]);
    }

    // Update third party balance if third party delivery
    if (o.deliver_method === 'third_party' && o.third_party_fee_usd > 0) {
      // Find or create third party
      let thirdParty = await query('SELECT id FROM third_parties WHERE name = ?', [o.third_party_name]);
      if (!thirdParty.length) {
        const result = await run(`
          INSERT INTO third_parties (name) VALUES (?)
        `, [o.third_party_name]);
        thirdParty = [{ id: result.id }];
      }

      await run(`
        UPDATE third_parties 
        SET account_balance_usd = account_balance_usd + ?, 
            account_balance_lbp = account_balance_lbp + ?
        WHERE id = ?
      `, [o.third_party_fee_usd, o.third_party_fee_lbp, thirdParty[0].id]);
    }

    // Update order delivered date
    await run(`
      UPDATE orders 
      SET date_delivered = now()
      WHERE id = ?
    `, [orderId]);

    console.log(`✅ Order ${orderId} marked as delivered and balances updated`);
  } catch (error) {
    console.error('Error handling order delivered:', error);
    throw error;
  }
}

// Function to record payment
async function recordPayment(paymentData) {
  try {
    const {
      orderId,
      accountType,
      accountId,
      amountUsd,
      amountLbp,
      method,
      note,
      createdBy
    } = paymentData;

    // Insert payment record
    const result = await run(`
      INSERT INTO payments (order_id, account_type, account_id, amount_usd, amount_lbp, method, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, accountType, accountId, amountUsd, amountLbp, method, note, createdBy]);

    // Update account balance
    if (accountType === 'client') {
      await run(`
        UPDATE clients 
        SET account_balance_usd = account_balance_usd - ?, 
            account_balance_lbp = account_balance_lbp - ?
        WHERE id = ?
      `, [amountUsd, amountLbp, accountId]);
    } else if (accountType === 'driver') {
      await run(`
        UPDATE drivers 
        SET account_balance_usd = account_balance_usd - ?, 
            account_balance_lbp = account_balance_lbp - ?
        WHERE id = ?
      `, [amountUsd, amountLbp, accountId]);
    } else if (accountType === 'third_party') {
      await run(`
        UPDATE third_parties 
        SET account_balance_usd = account_balance_usd - ?, 
            account_balance_lbp = account_balance_lbp - ?
        WHERE id = ?
      `, [amountUsd, amountLbp, accountId]);
    }

    // Update cashbox if cash payment
    if (method === 'cash') {
      await run(`
        INSERT INTO cashbox_entries (cashbox_id, type, amount_usd, amount_lbp, reference_id, reference_table, note, created_by)
        VALUES (1, 'credit', ?, ?, ?, 'payments', ?, ?)
      `, [amountUsd, amountLbp, result.id, note, createdBy]);
    }

    console.log(`✅ Payment recorded: ${result.id}`);
    return result;
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
}

module.exports = {
  enhanceAccountingSchema,
  createAccountingIndexes,
  calculateOrderTotals,
  handleOrderDelivered,
  recordPayment
};

// Run if called directly
if (require.main === module) {
  enhanceAccountingSchema()
    .then(() => {
      console.log('✅ Accounting schema enhancement completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Accounting schema enhancement failed:', error);
      process.exit(1);
    });
}