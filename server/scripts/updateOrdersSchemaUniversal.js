const { query, run, currentDatabase } = require('../config/database');

async function updateOrdersSchema() {
  console.log('🔧 Updating orders table schema...');
  console.log(`📊 Using database: ${currentDatabase()}`);
  
  try {
    const dbType = currentDatabase();
    
    if (dbType === 'postgresql') {
      // PostgreSQL specific updates
      console.log('📋 Adding prepaid_status column...');
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS prepaid_status TEXT DEFAULT 'not_prepaid' 
        CHECK (prepaid_status IN ('prepaid', 'not_prepaid'))
      `);

      console.log('📋 Adding third_party_id column...');
      await run(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS third_party_id INTEGER
      `);

      console.log('📋 Updating payment_status constraint...');
      await run(`
        ALTER TABLE orders 
        DROP CONSTRAINT IF EXISTS orders_payment_status_check
      `);
      
      await run(`
        ALTER TABLE orders 
        ADD CONSTRAINT orders_payment_status_check 
        CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'prepaid', 'refunded'))
      `);

      console.log('📋 Creating third_parties table...');
      await run(`
        CREATE TABLE IF NOT EXISTS third_parties (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          commission_rate NUMERIC(5,2) DEFAULT 0.00,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      console.log('📋 Adding foreign key constraint...');
      await run(`
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_third_party 
        FOREIGN KEY (third_party_id) REFERENCES third_parties(id) ON DELETE SET NULL
      `);

      console.log('📋 Creating indexes...');
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_prepaid_status ON orders(prepaid_status)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_third_party_id ON orders(third_party_id)
      `);

      console.log('📋 Creating order_history table...');
      await run(`
        CREATE TABLE IF NOT EXISTS order_history (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          old_values JSONB,
          new_values JSONB,
          changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at)
      `);

    } else if (dbType === 'sqlite') {
      // SQLite specific updates
      console.log('📋 Adding prepaid_status column...');
      await run(`
        ALTER TABLE orders 
        ADD COLUMN prepaid_status TEXT DEFAULT 'not_prepaid'
      `);

      console.log('📋 Adding third_party_id column...');
      await run(`
        ALTER TABLE orders 
        ADD COLUMN third_party_id INTEGER
      `);

      console.log('📋 Creating third_parties table...');
      await run(`
        CREATE TABLE IF NOT EXISTS third_parties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          commission_rate REAL DEFAULT 0.00,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('📋 Creating order_history table...');
      await run(`
        CREATE TABLE IF NOT EXISTS order_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER,
          action TEXT NOT NULL,
          old_values TEXT,
          new_values TEXT,
          changed_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
        )
      `);

      // Create indexes for SQLite
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_prepaid_status ON orders(prepaid_status)
      `);
      
      await run(`
        CREATE INDEX IF NOT EXISTS idx_orders_third_party_id ON orders(third_party_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at)
      `);
    }

    console.log('✅ Orders schema updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating orders schema:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  updateOrdersSchema()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { updateOrdersSchema };
