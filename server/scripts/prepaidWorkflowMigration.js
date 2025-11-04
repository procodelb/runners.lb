const { query, run, currentDatabase } = require('../config/database');

async function createPrepaidWorkflow() {
  console.log('🔧 Creating prepaid workflow schema...');
  console.log(`📊 Using database: ${currentDatabase()}`);
  
  try {
    const dbType = currentDatabase();
    
    if (dbType === 'postgresql') {
      // PostgreSQL specific updates
      console.log('📋 Adding prepaid fields to orders table...');
      
      // Add prepaid amount fields
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_amount_usd NUMERIC(12,2) DEFAULT 0
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_amount_lbp BIGINT DEFAULT 0
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_currency TEXT DEFAULT 'usd'
        CHECK (prepaid_currency IN ('usd', 'lbp'))
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_cashbox_entry_id INTEGER
      `);

      // Update payment_status to include prepaid
      console.log('📋 Updating payment_status constraint...');
      await run(`
        ALTER TABLE orders 
        DROP CONSTRAINT IF EXISTS orders_payment_status_check
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD CONSTRAINT orders_payment_status_check 
        CHECK (payment_status IN ('unpaid', 'prepaid', 'paid', 'refunded'))
      `);

      // Create driver_advances table
      console.log('📋 Creating driver_advances table...');
      await run(`
        CREATE TABLE IF NOT EXISTS driver_advances (
          id SERIAL PRIMARY KEY,
          driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          amount_usd NUMERIC(12,2) DEFAULT 0,
          amount_lbp BIGINT DEFAULT 0,
          cashbox_entry_id INTEGER,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'reimbursed')),
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          cleared_at TIMESTAMPTZ,
          notes TEXT
        )
      `);

      // Create cashbox_entries table if it doesn't exist
      console.log('📋 Creating/updating cashbox_entries table...');
      await run(`
        CREATE TABLE IF NOT EXISTS cashbox_entries (
          id SERIAL PRIMARY KEY,
          cashbox_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
          amount_usd NUMERIC(12,2) DEFAULT 0,
          amount_lbp BIGINT DEFAULT 0,
          reference_type TEXT CHECK (reference_type IN ('order', 'advance', 'payment', 'reimbursement')),
          reference_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT now(),
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          note TEXT
        )
      `);

      // Update payments table to support driver advances
      console.log('📋 Updating payments table...');
      await run(`
        ALTER TABLE payments 
        ADD COLUMN IF NOT EXISTS driver_advance_id INTEGER REFERENCES driver_advances(id) ON DELETE SET NULL
      `);
      
      await run(`
        ALTER TABLE payments 
        ADD COLUMN IF NOT EXISTS cashbox_entry_id INTEGER REFERENCES cashbox_entries(id) ON DELETE SET NULL
      `);

      // Create indexes for performance
      console.log('📋 Creating indexes...');
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_driver_id ON driver_advances(driver_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_order_id ON driver_advances(order_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_status ON driver_advances(status)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_cashbox_entries_type ON cashbox_entries(type)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_cashbox_entries_reference ON cashbox_entries(reference_type, reference_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_prepaid_driver ON orders(prepaid_driver_id)
      `);

    } else if (dbType === 'sqlite') {
      // SQLite specific updates
      console.log('📋 Adding prepaid fields to orders table (SQLite)...');
      
      // Add prepaid amount fields
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_amount_usd REAL DEFAULT 0
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_amount_lbp INTEGER DEFAULT 0
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_currency TEXT DEFAULT 'usd'
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_driver_id INTEGER REFERENCES drivers(id)
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_cashbox_entry_id INTEGER
      `);

      // Create driver_advances table
      console.log('📋 Creating driver_advances table (SQLite)...');
      await run(`
        CREATE TABLE IF NOT EXISTS driver_advances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER NOT NULL REFERENCES drivers(id),
          order_id INTEGER NOT NULL REFERENCES orders(id),
          amount_usd REAL DEFAULT 0,
          amount_lbp INTEGER DEFAULT 0,
          cashbox_entry_id INTEGER,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'reimbursed')),
          created_by INTEGER REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          cleared_at DATETIME,
          notes TEXT
        )
      `);

      // Create cashbox_entries table if it doesn't exist
      console.log('📋 Creating/updating cashbox_entries table (SQLite)...');
      await run(`
        CREATE TABLE IF NOT EXISTS cashbox_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cashbox_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
          amount_usd REAL DEFAULT 0,
          amount_lbp INTEGER DEFAULT 0,
          reference_type TEXT CHECK (reference_type IN ('order', 'advance', 'payment', 'reimbursement')),
          reference_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER REFERENCES users(id),
          note TEXT
        )
      `);

      // Update payments table to support driver advances
      console.log('📋 Updating payments table (SQLite)...');
      await run(`
        ALTER TABLE payments 
        ADD COLUMN driver_advance_id INTEGER REFERENCES driver_advances(id)
      `);
      
      await run(`
        ALTER TABLE payments 
        ADD COLUMN cashbox_entry_id INTEGER REFERENCES cashbox_entries(id)
      `);

      // Create indexes for performance
      console.log('📋 Creating indexes (SQLite)...');
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_driver_id ON driver_advances(driver_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_order_id ON driver_advances(order_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_driver_advances_status ON driver_advances(status)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_cashbox_entries_type ON cashbox_entries(type)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_cashbox_entries_reference ON cashbox_entries(reference_type, reference_id)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_prepaid_driver ON orders(prepaid_driver_id)
      `);
    }

    console.log('✅ Prepaid workflow schema created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating prepaid workflow schema:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  createPrepaidWorkflow()
    .then(() => {
      console.log('🎉 Prepaid workflow migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createPrepaidWorkflow };
