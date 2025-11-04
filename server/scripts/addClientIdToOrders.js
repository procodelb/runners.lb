const { Pool } = require('pg');

// Set environment variables directly (using working credentials from other scripts)
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.PG_SSL = 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function addClientIdToOrders() {
  console.log('🔧 Adding client_id field to orders table...');
  
  try {
    // Check if client_id column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'client_id'
    `;
    
    const columnExists = await pool.query(checkColumnQuery);
    
    if (columnExists.rows.length === 0) {
      // Add client_id column with foreign key reference to clients table
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
      `);
      
      console.log('✅ Added client_id column to orders table');
      
      // Create index for better performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id)
      `);
      
      console.log('✅ Created index on client_id column');
      
      // Update existing orders to link them to clients based on brand_name
      console.log('🔄 Linking existing orders to clients based on brand_name...');
      
      const updateQuery = `
        UPDATE orders 
        SET client_id = c.id 
        FROM clients c 
        WHERE orders.brand_name = c.business_name 
        AND orders.client_id IS NULL
      `;
      
      const updateResult = await pool.query(updateQuery);
      console.log(`✅ Linked ${updateResult.rowCount} existing orders to clients`);
      
    } else {
      console.log('ℹ️  client_id column already exists in orders table');
    }
    
    // Verify the schema
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('client_id', 'brand_name')
      ORDER BY column_name
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    console.log('📋 Orders table schema verification:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('✅ Orders table schema update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating orders schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  addClientIdToOrders()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addClientIdToOrders };
