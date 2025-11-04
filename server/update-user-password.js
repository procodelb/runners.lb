const bcrypt = require('bcryptjs');
const mcp = require('./mcp');

async function updateUserPassword() {
  try {
    console.log('🔧 Updating user password...\n');
    
    await mcp.ensureReady();
    
    const testEmail = 'runners.leb@gmail.com';
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    console.log('1️⃣ Updating password for:', testEmail);
    
    // Update the password
    await mcp.queryWithJoins(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2',
      [hashedPassword, testEmail]
    );
    
    console.log('✅ Password updated successfully!');
    
    // Test the login
    console.log('\n2️⃣ Testing login...');
    const axios = require('axios');
    const API_BASE = 'http://localhost:5000/api';
    
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      
      console.log('✅ Login test successful!');
      console.log('🔑 Token received:', loginResponse.data.data?.token ? 'YES' : 'NO');
      
      // Test protected endpoints
      const token = loginResponse.data.data?.token || loginResponse.data.token;
      if (token) {
        console.log('\n3️⃣ Testing protected endpoints...');
        
        const headers = { Authorization: `Bearer ${token}` };
        
        // Test cashbox
        const cashboxResponse = await axios.get(`${API_BASE}/cashbox/balance`, { headers });
        console.log('✅ Cashbox endpoint working');
        
        // Test transactions
        const transactionsResponse = await axios.get(`${API_BASE}/transactions?limit=5`, { headers });
        console.log('✅ Transactions endpoint working');
        
        console.log('\n🎉 All tests passed! The system is working!');
        console.log('\n📋 Login Credentials:');
        console.log('   Email: runners.leb@gmail.com');
        console.log('   Password: admin123');
        console.log('\n🚀 You can now:');
        console.log('1. Start the client: cd client && npm run dev');
        console.log('2. Login with the above credentials');
        console.log('3. Access the Cashbox page without errors');
      }
      
    } catch (error) {
      console.error('❌ Login test failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error updating password:', error.message);
  }
}

if (require.main === module) {
  updateUserPassword();
}

module.exports = { updateUserPassword };
