const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'soufian_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
  try {
    console.log('Setting up Soufian ERP Database...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        language CHAR(2) DEFAULT 'en',
        theme TEXT DEFAULT 'light',
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create clients/CRM table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        address TEXT,
        instagram TEXT,
        website TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        category TEXT,
        currency_preference CHAR(3) DEFAULT 'LBP',
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create drivers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        notes TEXT,
        active BOOLEAN DEFAULT true,
        default_fee_lbp BIGINT DEFAULT 0,
        default_fee_usd NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_ref TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('ecommerce', 'instant', 'go_to_market')),
        is_purchase BOOLEAN DEFAULT false,
        customer_phone TEXT,
        customer_name TEXT,
        customer_address TEXT,
        brand_name TEXT,
        voucher_code TEXT,
        deliver_method TEXT CHECK (deliver_method IN ('in_house', 'third_party')),
        third_party_name TEXT,
        third_party_fee_usd NUMERIC(10,2) DEFAULT 0,
        third_party_fee_lbp BIGINT DEFAULT 0,
        driver_id INTEGER REFERENCES drivers(id),
        driver_fee_usd NUMERIC(10,2) DEFAULT 0,
        driver_fee_lbp BIGINT DEFAULT 0,
        instant BOOLEAN DEFAULT false,
        notes TEXT,
        status TEXT DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled')),
        payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
        total_usd NUMERIC(12,2) DEFAULT 0,
        total_lbp BIGINT DEFAULT 0,
        delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
        delivery_fee_lbp BIGINT DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        completed_at TIMESTAMP
      );
    `);

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        tx_type TEXT NOT NULL,
        reference_id INTEGER,
        reference_table TEXT,
        details JSONB,
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        exchange_rate NUMERIC(18,6) DEFAULT 1,
        debit_account TEXT,
        credit_account TEXT,
        created_at TIMESTAMP DEFAULT now(),
        created_by INTEGER REFERENCES users(id)
      );
    `);

    // Create cashbox entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cashbox_entries (
        id SERIAL PRIMARY KEY,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'driver_advance', 'driver_return', 'order_payment', 'third_party_fee')),
        amount_usd NUMERIC(12,2) DEFAULT 0,
        amount_lbp BIGINT DEFAULT 0,
        exchange_rate NUMERIC(18,6) DEFAULT 1,
        actor_type TEXT CHECK (actor_type IN ('driver', 'client', 'third_party', 'system')),
        actor_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now(),
        created_by INTEGER REFERENCES users(id)
      );
    `);

    // Create price list table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_list (
        id SERIAL PRIMARY KEY,
        country TEXT DEFAULT 'Lebanon',
        area_name TEXT NOT NULL,
        fee_lbp BIGINT DEFAULT 200000,
        fee_usd NUMERIC(10,2) DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create audit log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
        old_values JSONB,
        new_values JSONB,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
      CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);
      CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(reference_table, reference_id);
      CREATE INDEX IF NOT EXISTS idx_cashbox_entries_actor ON cashbox_entries(actor_type, actor_id);
    `);

    // Insert default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Soufi@n123', 10);
    
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (email) DO NOTHING
    `, ['soufian@gmail.com', hashedPassword, 'Soufian Admin', 'admin']);

    // Insert default price list for Lebanon
    await pool.query(`
      INSERT INTO price_list (country, area_name, fee_lbp, fee_usd) 
      VALUES 
        ('Lebanon', 'Beirut', 200000, 2.25),
        ('Lebanon', 'Mount Lebanon', 200000, 2.25),
        ('Lebanon', 'North Lebanon', 200000, 2.25),
        ('Lebanon', 'South Lebanon', 200000, 2.25),
        ('Lebanon', 'Bekaa', 200000, 2.25),
        ('Lebanon', 'Nabatieh', 200000, 2.25)
      ON CONFLICT (country, area_name) DO NOTHING
    `;

    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created: users, clients, drivers, orders, transactions, cashbox_entries, price_list, audit_log');
    console.log('🔑 Default admin user created: soufian@gmail.com / Soufi@n123');
    console.log('💰 Default price list created for Lebanon areas');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(console.error);
