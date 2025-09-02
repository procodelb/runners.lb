const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database file path
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Create SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
      } else {
    console.log('✅ Connected to SQLite database');
    console.log(`📁 Database file: ${dbPath}`);
    
    // Fix database schema
    fixDatabase();
  }
});

// Fix database schema
const fixDatabase = async () => {
  try {
    console.log('🔧 Fixing Soufian ERP Database Schema...');

    // Check if clients table exists, if not create it
    const clientsTableExists = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'");
    if (clientsTableExists.length === 0) {
      console.log('📋 Creating clients table...');
      await runQuery(`
        CREATE TABLE clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          business_name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT,
          address TEXT,
          instagram TEXT,
          website TEXT,
          google_location TEXT,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Clients table created');
    } else {
      console.log('✅ Clients table already exists');
    }

    // Check if crm table exists and migrate data if needed
    const crmTableExists = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='crm'");
    if (crmTableExists.length > 0) {
      console.log('🔄 Migrating data from crm table to clients table...');
      
      // Check if clients table has data
      const clientsCount = await query('SELECT COUNT(*) as count FROM clients');
      if (clientsCount[0].count === 0) {
        // Migrate data from crm to clients
        await runQuery(`
          INSERT INTO clients (business_name, contact_person, phone, address, instagram, website, google_location, category, created_at, updated_at)
          SELECT business_name, contact_person, phone, address, instagram_website, '', location_google, category, created_at, updated_at
          FROM crm
        `);
        console.log('✅ Data migrated from crm to clients table');
      }
      
      // Drop the old crm table
      await runQuery('DROP TABLE crm');
      console.log('✅ Old crm table dropped');
    }

    // Add missing columns to price_list table
    try {
      await runQuery('ALTER TABLE price_list ADD COLUMN fees_usd REAL DEFAULT 0');
      console.log('✅ Added fees_usd column to price_list table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ fees_usd column already exists in price_list table');
      } else {
        console.log('⚠️ Could not add fees_usd column:', error.message);
      }
    }

    // Add missing columns to users table
    try {
      await runQuery('ALTER TABLE users ADD COLUMN theme TEXT DEFAULT "light"');
      console.log('✅ Added theme column to users table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ theme column already exists in users table');
      } else {
        console.log('⚠️ Could not add theme column:', error.message);
      }
    }

    try {
      await runQuery('ALTER TABLE users ADD COLUMN language TEXT DEFAULT "en"');
      console.log('✅ Added language column to users table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ language column already exists in users table');
      } else {
        console.log('⚠️ Could not add language column:', error.message);
      }
    }

    // Add missing columns to drivers table
    try {
      await runQuery('ALTER TABLE drivers ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to drivers table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ notes column already exists in drivers table');
      } else {
        console.log('⚠️ Could not add notes column:', error.message);
      }
    }

    try {
      await runQuery('ALTER TABLE drivers ADD COLUMN active BOOLEAN DEFAULT 1');
      console.log('✅ Added active column to drivers table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ active column already exists in drivers table');
      } else {
        console.log('⚠️ Could not add active column:', error.message);
      }
    }

    try {
      await runQuery('ALTER TABLE drivers ADD COLUMN default_fee_lbp INTEGER DEFAULT 0');
      console.log('✅ Added default_fee_lbp column to drivers table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ default_fee_lbp column already exists in drivers table');
      } else {
        console.log('⚠️ Could not add default_fee_lbp column:', error.message);
      }
    }

    try {
      await runQuery('ALTER TABLE drivers ADD COLUMN default_fee_usd REAL DEFAULT 0');
      console.log('✅ Added default_fee_usd column to drivers table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('✅ default_fee_usd column already exists in drivers table');
      } else {
        console.log('⚠️ Could not add default_fee_usd column:', error.message);
      }
    }

    // Update price_list data to include fees_usd
    await runQuery(`
      UPDATE price_list SET fees_usd = 0 WHERE fees_usd IS NULL
    `);

    console.log('✅ Database schema fixed successfully!');

    } catch (error) {
    console.error('❌ Database fix failed:', error);
  } finally {
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  }
};

// Utility function to run queries with error handling
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Query error:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Utility function to run single queries (INSERT, UPDATE, DELETE)
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ Query error:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};
