const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createDemoUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating demo user for accounting system...\n');
    
    // Demo credentials from login page
    const demoEmail = 'soufian@gmail.com';
    const demoPassword = 'Soufi@n123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    
    console.log('1️⃣ Checking if demo user exists...');
    const existingUser = await client.query('SELECT id, email FROM users WHERE email = $1', [demoEmail]);
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  Demo user already exists, updating password...');
      await client.query(
        'UPDATE users SET password = $1, updated_at = now() WHERE email = $2',
        [hashedPassword, demoEmail]
      );
      console.log('✅ Password updated for existing demo user');
    } else {
      console.log('➕ Creating new demo user...');
      await client.query(`
        INSERT INTO users (email, username, password, full_name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, now(), now())
      `, [demoEmail, 'soufian', hashedPassword, 'Soufian Admin', 'admin']);
      console.log('✅ Demo user created successfully');
    }
    
    console.log('\n2️⃣ Testing login...');
    
    // Test the login
    const axios = require('axios');
    const API_BASE = 'http://localhost:5000/api';
    
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: demoEmail,
        password: demoPassword
      });
      
      console.log('✅ Login test successful!');
      console.log('🔑 Token received:', loginResponse.data.data?.token ? 'YES' : 'NO');
      
      // Test accounting endpoint
      const token = loginResponse.data.data?.token || loginResponse.data.token;
      if (token) {
        try {
          const accountingResponse = await axios.get(`${API_BASE}/accounting/clients`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('✅ Accounting endpoint test successful');
        } catch (error) {
          console.log('⚠️  Accounting endpoint test failed (this is expected if no data exists):', error.response?.status);
        }
      }
      
    } catch (error) {
      console.error('❌ Login test failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Demo user setup completed!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('👤 Email: soufian@gmail.com');
    console.log('🔑 Password: Soufi@n123');
    console.log('\n💡 You can now login to the accounting system!');
    
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
    
    if (error.code === '42P01') {
      console.log('\n💡 Users table does not exist. Run database migration first.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  createDemoUser();
}

module.exports = { createDemoUser };
