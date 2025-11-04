const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTestUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating test user for login...\n');
    
    // Check if users table exists and what users we have
    console.log('1️⃣ Checking existing users...');
    const existingUsers = await client.query('SELECT id, email, username FROM users LIMIT 10');
    
    if (existingUsers.rows.length > 0) {
      console.log('📋 Existing users:');
      existingUsers.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.username})`);
      });
    } else {
      console.log('📋 No users found in database');
    }
    
    // Create test user
    console.log('\n2️⃣ Creating test user...');
    const testEmail = 'runners.leb@gmail.com';
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    // Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [testEmail]);
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists, updating password...');
      await client.query(
        'UPDATE users SET password = $1, updated_at = now() WHERE email = $2',
        [hashedPassword, testEmail]
      );
      console.log('✅ Password updated for existing user');
    } else {
      console.log('➕ Creating new user...');
      await client.query(`
        INSERT INTO users (email, username, password, full_name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, now(), now())
      `, [testEmail, 'admin', hashedPassword, 'System Administrator', 'admin']);
      console.log('✅ New user created');
    }
    
    // Also create a simple user for testing
    const simpleEmail = 'test@example.com';
    const simplePassword = '123456';
    const simpleHashedPassword = await bcrypt.hash(simplePassword, 10);
    
    const existingSimpleUser = await client.query('SELECT id FROM users WHERE email = $1', [simpleEmail]);
    
    if (existingSimpleUser.rows.length === 0) {
      await client.query(`
        INSERT INTO users (email, username, password, full_name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, now(), now())
      `, [simpleEmail, 'testuser', simpleHashedPassword, 'Test User', 'user']);
      console.log('✅ Simple test user created');
    }
    
    console.log('\n3️⃣ Testing login credentials...');
    
    // Test the login
    const axios = require('axios');
    const API_BASE = 'http://localhost:5000/api';
    
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      
      console.log('✅ Login test successful!');
      console.log('🔑 Token received:', loginResponse.data.data?.token ? 'YES' : 'NO');
      
      // Test cashbox endpoint
      const token = loginResponse.data.data?.token || loginResponse.data.token;
      if (token) {
        const cashboxResponse = await axios.get(`${API_BASE}/cashbox/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Cashbox endpoint test successful');
      }
      
    } catch (error) {
      console.error('❌ Login test failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 User creation completed!');
    console.log('\n📋 Login Credentials:');
    console.log('👤 Admin User:');
    console.log('   Email: runners.leb@gmail.com');
    console.log('   Password: admin123');
    console.log('\n👤 Simple User:');
    console.log('   Email: test@example.com');
    console.log('   Password: 123456');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    
    if (error.code === '42P01') {
      console.log('\n💡 Users table does not exist. Run database migration first:');
      console.log('cd server && node scripts/updateCashboxSchema.js');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  createTestUser();
}

module.exports = { createTestUser };
