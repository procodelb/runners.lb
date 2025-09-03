const { query, run } = require('../config/database');

async function fixDatabase() {
  console.log('🔧 Starting database fixes...');
  
  try {
    // 1. Check and fix cashbox table structure
    console.log('📦 Checking cashbox table structure...');
    try {
      // First, let's see what columns exist
      const tableInfo = await query("PRAGMA table_info(cashbox)");
      console.log('Current cashbox columns:', tableInfo.map(col => col.name));
      
      // Check if we need to add missing columns
      const columnNames = tableInfo.map(col => col.name);
      
      if (!columnNames.includes('initial_balance_usd')) {
        console.log('Adding initial_balance_usd column...');
        await run('ALTER TABLE cashbox ADD COLUMN initial_balance_usd DECIMAL(10,2) DEFAULT 0');
      }
      
      if (!columnNames.includes('initial_balance_lbp')) {
        console.log('Adding initial_balance_lbp column...');
        await run('ALTER TABLE cashbox ADD COLUMN initial_balance_lbp INTEGER DEFAULT 0');
      }
      
      if (!columnNames.includes('balance_usd')) {
        console.log('Adding balance_usd column...');
        await run('ALTER TABLE cashbox ADD COLUMN balance_usd DECIMAL(10,2) DEFAULT 0');
      }
      
      if (!columnNames.includes('balance_lbp')) {
        console.log('Adding balance_lbp column...');
        await run('ALTER TABLE cashbox ADD COLUMN balance_lbp INTEGER DEFAULT 0');
      }
      
      console.log('✅ Cashbox table structure updated');
    } catch (error) {
      console.log('ℹ️ Cashbox table structure check:', error.message);
    }

    // 2. Check and fix transactions table
    console.log('💳 Checking transactions table...');
    try {
      const txTableInfo = await query("PRAGMA table_info(transactions)");
      const txColumnNames = txTableInfo.map(col => col.name);
      
      if (!txColumnNames.includes('order_id')) {
        console.log('Adding order_id column to transactions...');
        await run('ALTER TABLE transactions ADD COLUMN order_id INTEGER');
      }
      
      if (!txColumnNames.includes('reference')) {
        console.log('Adding reference column to transactions...');
        await run('ALTER TABLE transactions ADD COLUMN reference VARCHAR(50)');
      }
      
      if (!txColumnNames.includes('description')) {
        console.log('Adding description column to transactions...');
        await run('ALTER TABLE transactions ADD COLUMN description TEXT');
      }
      
      console.log('✅ Transactions table checked');
    } catch (error) {
      console.log('ℹ️ Transactions table check:', error.message);
    }

    // 3. Ensure cashbox_entries table exists
    console.log('💰 Checking cashbox_entries table...');
    try {
      await run(`
        CREATE TABLE IF NOT EXISTS cashbox_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_type VARCHAR(50) NOT NULL,
          amount_usd DECIMAL(10,2) DEFAULT 0,
          amount_lbp INTEGER DEFAULT 0,
          description TEXT,
          actor_type VARCHAR(50),
          actor_id INTEGER,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Cashbox entries table ensured');
    } catch (error) {
      console.log('ℹ️ Cashbox entries table already exists');
    }

    // 4. Ensure exchange_rates table exists
    console.log('💱 Checking exchange_rates table...');
    try {
      await run(`
        CREATE TABLE IF NOT EXISTS exchange_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lbp_per_usd DECIMAL(10,2) NOT NULL,
          effective_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Exchange rates table ensured');
    } catch (error) {
      console.log('ℹ️ Exchange rates table already exists');
    }

    // 5. Insert default exchange rate if not exists
    console.log('💱 Setting default exchange rate...');
    try {
      const existingRate = await query('SELECT id FROM exchange_rates LIMIT 1');
      if (existingRate.length === 0) {
        await run('INSERT INTO exchange_rates (lbp_per_usd) VALUES (?)', [89000]);
        console.log('✅ Default exchange rate inserted');
      } else {
        console.log('ℹ️ Exchange rate already exists');
      }
    } catch (error) {
      console.log('ℹ️ Exchange rate setup error:', error.message);
    }

    // 6. Ensure cashbox has initial record
    console.log('💰 Ensuring cashbox initial record...');
    try {
      const cashboxExists = await query('SELECT id FROM cashbox WHERE id = 1');
      if (cashboxExists.length === 0) {
        await run(`
          INSERT INTO cashbox (id, balance_usd, balance_lbp, initial_balance_usd, initial_balance_lbp) 
          VALUES (1, 0, 0, 0, 0)
        `);
        console.log('✅ Cashbox initial record created');
      } else {
        console.log('ℹ️ Cashbox record already exists');
      }
    } catch (error) {
      console.log('ℹ️ Cashbox setup error:', error.message);
    }

    console.log('🎉 Database fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Database fix error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixDatabase()
    .then(() => {
      console.log('✅ Database fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixDatabase;
