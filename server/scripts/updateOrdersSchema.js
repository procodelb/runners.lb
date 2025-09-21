const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateOrdersSchema() {
  console.log('🔧 Updating orders table schema...');
  
  try {
    // Add prepaid_status column
    console.log('📋 Adding prepaid_status column...');
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS prepaid_status TEXT DEFAULT 'not_prepaid' 
      CHECK (prepaid_status IN ('prepaid', 'not_prepaid'))
    `);

    // Add third_party_id column
    console.log('📋 Adding third_party_id column...');
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS third_party_id INTEGER
    `);

    // Update payment_status to include prepaid
    console.log('📋 Updating payment_status constraint...');
    await pool.query(`
      ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_payment_status_check
    `);
    
    await pool.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'prepaid', 'refunded'))
    `);

    // Create third_parties table if it doesn't exist
    console.log('📋 Creating third_parties table...');
    await pool.query(`
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

    // Add foreign key constraint for third_party_id
    console.log('📋 Adding foreign key constraint...');
    await pool.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT fk_orders_third_party 
      FOREIGN KEY (third_party_id) REFERENCES third_parties(id) ON DELETE SET NULL
    `);

    // Create indexes for better performance
    console.log('📋 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_prepaid_status ON orders(prepaid_status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_third_party_id ON orders(third_party_id)
    `);

    // Create order_history table for audit trail
    console.log('📋 Creating order_history table...');
    await pool.query(`
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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at)
    `);

    console.log('✅ Orders schema updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating orders schema:', error);
    throw error;
  } finally {
    await pool.end();
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
