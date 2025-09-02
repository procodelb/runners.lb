const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Neon database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function updateUserCredentials() {
  console.log('🔧 Updating user credentials in Neon database...');
  console.log('📡 Database URL:', DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));

  try {
    // Test connection
    await pool.query('SELECT 1 as test');
    console.log('✅ Connected to Neon database');

    // Update or create the user with the requested credentials
    const email = 'soufian@gmail.com';
    const password = 'Soufi@n123';
    const fullName = 'Soufian Admin';
    
    // Check if user exists
    const { rows: existingUser } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.length > 0) {
      // Update existing user
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, role = $3 WHERE email = $4',
        [hash, fullName, 'admin', email]
      );
      console.log('✅ Updated existing user credentials');
    } else {
      // Create new user
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users(email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        [email, hash, fullName, 'admin']
      );
      console.log('✅ Created new user with requested credentials');
    }

    // Verify the user was created/updated
    const { rows: user } = await pool.query('SELECT id, email, full_name, role FROM users WHERE email = $1', [email]);
    console.log('✅ User details:', user[0]);

    console.log('\n🔑 Updated Credentials:');
    console.log('Email: soufian@gmail.com');
    console.log('Password: Soufi@n123');
    console.log('Role: admin');

  } catch (error) {
    console.error('❌ Error updating user credentials:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the update
updateUserCredentials().catch(console.error);
