const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
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
    
    // Initialize database tables
    initDatabase();
  }
});

// Initialize database tables
const initDatabase = async () => {
  try {
    console.log('🔧 Setting up Soufian ERP Database...');

    // Users table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'admin',
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'en',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clients table (renamed from crm for consistency)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS clients (
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

    // Drivers table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        default_fee_lbp INTEGER DEFAULT 0,
        default_fee_usd REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Orders table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_ref TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('ecommerce', 'instant', 'go_to_market')),
        is_purchase BOOLEAN DEFAULT 0,
        customer_phone TEXT,
        customer_name TEXT,
        customer_address TEXT,
        brand_name TEXT,
        voucher_code TEXT,
        deliver_method TEXT CHECK(deliver_method IN ('in_house', 'third_party')),
        third_party_name TEXT,
        third_party_fee_usd REAL DEFAULT 0,
        third_party_fee_lbp INTEGER DEFAULT 0,
        driver_id INTEGER,
        driver_fee_usd REAL DEFAULT 0,
        driver_fee_lbp INTEGER DEFAULT 0,
        instant BOOLEAN DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'new' CHECK(status IN ('new', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled')),
        payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
        total_usd REAL DEFAULT 0,
        total_lbp INTEGER DEFAULT 0,
        delivery_fee_usd REAL DEFAULT 0,
        delivery_fee_lbp INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (driver_id) REFERENCES drivers (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Transactions table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount_usd REAL DEFAULT 0,
        amount_lbp INTEGER DEFAULT 0,
        description TEXT,
        reference_id INTEGER,
        reference_table TEXT,
        actor_type TEXT CHECK (actor_type IN ('driver', 'client', 'third_party', 'system')),
        actor_id INTEGER,
        debit_account TEXT,
        credit_account TEXT,
        exchange_rate REAL DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Cashbox table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS cashbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount_usd REAL DEFAULT 0,
        amount_lbp INTEGER DEFAULT 0,
        description TEXT,
        driver_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Price list table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS price_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country TEXT NOT NULL,
        area TEXT NOT NULL,
        fees_lbp INTEGER DEFAULT 200000,
        fees_usd REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await runQuery('CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON orders(order_ref)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)');

    console.log('✅ Database tables initialized');

    // Check if admin user exists
    const adminUser = await query('SELECT * FROM users WHERE email = ?', ['soufian@gmail.com']);
    
    if (adminUser.length === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('Soufi@n123', 12);
      
      await runQuery(
        'INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)',
        ['soufian@gmail.com', hashedPassword, 'Soufian Admin', 'admin']
      );
      
      console.log('🔑 Default admin user created: soufian@gmail.com / Soufi@n123');
    } else {
      console.log('🔑 Admin user already exists');
    }

    // Insert default price list for Lebanon
    await runQuery(`
      INSERT OR IGNORE INTO price_list (country, area, fees_lbp, fees_usd) VALUES 
        ('Lebanon', 'Beirut', 200000, 0),
        ('Lebanon', 'Mount Lebanon', 200000, 0),
        ('Lebanon', 'North Lebanon', 200000, 0),
        ('Lebanon', 'South Lebanon', 200000, 0),
        ('Lebanon', 'Bekaa', 200000, 0),
        ('Lebanon', 'Nabatieh', 200000, 0)
    `);

    console.log('💰 Default price list created for Lebanon areas');
    console.log('✅ Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
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
