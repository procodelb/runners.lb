const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixCashboxEntryTypes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing cashbox_entries entry_type constraint...');
    
    await client.query('BEGIN');
    
    // Drop existing constraint
    await client.query(`
      ALTER TABLE cashbox_entries 
      DROP CONSTRAINT IF EXISTS cashbox_entries_entry_type_check;
    `);
    
    // Add comprehensive constraint with ALL entry types
    await client.query(`
      ALTER TABLE cashbox_entries 
      ADD CONSTRAINT cashbox_entries_entry_type_check 
      CHECK (entry_type IN (
        'cash_in', 'cash_out', 'order_cash_in', 'order_cash_out',
        'client_cashout', 'prepaid_cashout', 'driver_advance', 
        'driver_return', 'driver_payout', 'third_party_payable', 
        'capital_add', 'capital_edit', 'income', 'expense', 
        'capital_expense', 'order_income', 'delivery_fee',
        'client_payment'
      ));
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ Successfully updated cashbox_entries entry_type constraint');
    
    // Verify the constraint was added
    const result = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'cashbox_entries_entry_type_check';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified constraint:', result.rows[0].check_clause);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing cashbox entry types:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixCashboxEntryTypes()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

