const { Pool } = require('pg');

// Set environment variables for Neon
process.env.USE_SQLITE = 'false';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function enhanceAccountingSchema() {
  console.log('🔧 Enhancing database schema for comprehensive accounting module...');

  // 1. Add missing columns to transactions table
  console.log('📋 Enhancing transactions table...');
  await pool.query(`
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('credit', 'debit')),
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  `);

  // 2. Create order_history table for cashout records
  console.log('📋 Creating order_history table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('cashout', 'payment', 'delivery', 'cancellation')),
      amount_usd NUMERIC(12,2) DEFAULT 0,
      amount_lbp BIGINT DEFAULT 0,
      description TEXT,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 3. Create accounting_snapshots table for cashout records
  console.log('📋 Creating accounting_snapshots table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounting_snapshots (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'driver', 'third_party')),
      entity_id INTEGER NOT NULL,
      snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('cashout', 'balance_check', 'monthly_summary')),
      total_orders INTEGER DEFAULT 0,
      total_amount_usd NUMERIC(12,2) DEFAULT 0,
      total_amount_lbp BIGINT DEFAULT 0,
      total_fees_usd NUMERIC(12,2) DEFAULT 0,
      total_fees_lbp BIGINT DEFAULT 0,
      net_balance_usd NUMERIC(12,2) DEFAULT 0,
      net_balance_lbp BIGINT DEFAULT 0,
      snapshot_data JSONB,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 4. Create third_party_orders table for tracking third-party operations
  console.log('📋 Creating third_party_orders table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS third_party_orders (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      third_party_name TEXT NOT NULL,
      third_party_fee_usd NUMERIC(10,2) DEFAULT 0,
      third_party_fee_lbp BIGINT DEFAULT 0,
      our_share_usd NUMERIC(10,2) DEFAULT 0,
      our_share_lbp BIGINT DEFAULT 0,
      delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
      delivery_fee_lbp BIGINT DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 5. Create driver_operations table for tracking driver activities
  console.log('📋 Creating driver_operations table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_operations (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      operation_type TEXT NOT NULL CHECK (operation_type IN ('delivery', 'purchase', 'fuel_expense', 'maintenance', 'other')),
      amount_usd NUMERIC(10,2) DEFAULT 0,
      amount_lbp BIGINT DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 6. Create client_accounts table for detailed client tracking
  console.log('📋 Creating client_accounts table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('order_placed', 'payment_received', 'refund_issued', 'fee_charged')),
      amount_usd NUMERIC(12,2) DEFAULT 0,
      amount_lbp BIGINT DEFAULT 0,
      balance_usd NUMERIC(12,2) DEFAULT 0,
      balance_lbp BIGINT DEFAULT 0,
      description TEXT,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log('✅ Schema enhancements completed');
}

async function createAccountingIndexes() {
  console.log('🔍 Creating indexes for accounting performance...');

  // Order history indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_client_id ON order_history(client_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_driver_id ON order_history(driver_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_action_type ON order_history(action_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at);');

  // Accounting snapshots indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_accounting_snapshots_entity ON accounting_snapshots(entity_type, entity_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_accounting_snapshots_type ON accounting_snapshots(snapshot_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_accounting_snapshots_created_at ON accounting_snapshots(created_at);');

  // Third party orders indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_third_party_orders_order_id ON third_party_orders(order_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_third_party_orders_name ON third_party_orders(third_party_name);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_third_party_orders_status ON third_party_orders(status);');

  // Driver operations indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_driver_operations_driver_id ON driver_operations(driver_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_driver_operations_order_id ON driver_operations(order_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_driver_operations_type ON driver_operations(operation_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_driver_operations_created_at ON driver_operations(created_at);');

  // Client accounts indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_client_accounts_client_id ON client_accounts(client_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_client_accounts_order_id ON client_accounts(order_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_client_accounts_type ON client_accounts(transaction_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_client_accounts_created_at ON client_accounts(created_at);');

  // Enhanced transactions indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at);');

  console.log('✅ Accounting indexes created successfully');
}

async function createAccountingViews() {
  console.log('📊 Creating accounting views for better performance...');

  // Client account summary view
  await pool.query(`
    CREATE OR REPLACE VIEW client_account_summary AS
    SELECT 
      c.id as client_id,
      c.business_name,
      c.contact_person,
      c.phone,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
      COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0) as paid_amount_usd,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0) as paid_amount_lbp,
      COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) as pending_amount_usd,
      COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) as pending_amount_lbp,
      MAX(o.created_at) as last_order_date
    FROM clients c
    LEFT JOIN orders o ON c.id = o.customer_name::INTEGER OR c.business_name = o.customer_name
    GROUP BY c.id, c.business_name, c.contact_person, c.phone;
  `);

  // Driver operations summary view
  await pool.query(`
    CREATE OR REPLACE VIEW driver_operations_summary AS
    SELECT 
      d.id as driver_id,
      d.full_name,
      d.phone,
      COUNT(DISTINCT o.id) as total_deliveries,
      COUNT(DISTINCT do.id) as total_operations,
      COALESCE(SUM(o.driver_fee_usd), 0) as total_delivery_fees_usd,
      COALESCE(SUM(o.driver_fee_lbp), 0) as total_delivery_fees_lbp,
      COALESCE(SUM(do.amount_usd), 0) as total_operation_amount_usd,
      COALESCE(SUM(do.amount_lbp), 0) as total_operation_amount_lbp,
      COALESCE(SUM(CASE WHEN do.operation_type = 'fuel_expense' THEN do.amount_lbp ELSE 0 END), 0) as total_fuel_expenses_lbp,
      MAX(o.created_at) as last_delivery_date
    FROM drivers d
    LEFT JOIN orders o ON d.id = o.driver_id
    LEFT JOIN driver_operations do ON d.id = do.driver_id
    GROUP BY d.id, d.full_name, d.phone;
  `);

  // Third party revenue summary view
  await pool.query(`
    CREATE OR REPLACE VIEW third_party_revenue_summary AS
    SELECT 
      tpo.third_party_name,
      COUNT(DISTINCT tpo.order_id) as total_orders,
      COALESCE(SUM(tpo.third_party_fee_usd), 0) as total_third_party_fees_usd,
      COALESCE(SUM(tpo.third_party_fee_lbp), 0) as total_third_party_fees_lbp,
      COALESCE(SUM(tpo.our_share_usd), 0) as total_our_share_usd,
      COALESCE(SUM(tpo.our_share_lbp), 0) as total_our_share_lbp,
      COALESCE(SUM(tpo.delivery_fee_usd), 0) as total_delivery_fees_usd,
      COALESCE(SUM(tpo.delivery_fee_lbp), 0) as total_delivery_fees_lbp,
      MAX(tpo.created_at) as last_order_date
    FROM third_party_orders tpo
    GROUP BY tpo.third_party_name;
  `);

  console.log('✅ Accounting views created successfully');
}

async function main() {
  try {
    console.log('🚀 Starting accounting schema enhancement...');
    console.log('📡 Connecting to:', DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    // Test connection
    await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // Enhance schema
    await enhanceAccountingSchema();
    
    // Create indexes
    await createAccountingIndexes();
    
    // Create views
    await createAccountingViews();
    
    console.log('🎉 Accounting schema enhancement completed successfully!');
    console.log('📊 Database is ready for comprehensive accounting operations');
    
  } catch (error) {
    console.error('❌ Schema enhancement failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the enhancement
main();
