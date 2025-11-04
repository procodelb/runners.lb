const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testLogin() {
  try {
    console.log('🧪 Testing Login Fix...\n');

    // Test 1: Health check
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Server is healthy:', healthResponse.data);

    // Test 2: Login with correct credentials
    console.log('\n2️⃣ Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'runners.leb@gmail.com',
      password: 'admin123'
    });
    
    console.log('✅ Login successful!');
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('🔑 Token received:', token ? 'YES' : 'NO');
    
    if (!token) {
      console.log('❌ No token in response. Response:', loginResponse.data);
      return;
    }

    // Test 3: Test protected endpoints with token
    console.log('\n3️⃣ Testing protected endpoints...');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test transactions endpoint
    try {
      const transactionsResponse = await axios.get(`${API_BASE}/transactions?limit=5`, { headers });
      console.log('✅ Transactions endpoint working:', transactionsResponse.data.data?.length || 0, 'transactions');
    } catch (error) {
      console.log('❌ Transactions endpoint failed:', error.response?.data?.message || error.message);
    }
    
    // Test cashbox endpoint
    try {
      const cashboxResponse = await axios.get(`${API_BASE}/cashbox/balance`, { headers });
      console.log('✅ Cashbox endpoint working:', cashboxResponse.data.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log('❌ Cashbox endpoint failed:', error.response?.data?.message || error.message);
    }
    
    // Test dashboard stats
    try {
      const dashboardResponse = await axios.get(`${API_BASE}/dashboard/stats`, { headers });
      console.log('✅ Dashboard stats working:', dashboardResponse.data.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log('❌ Dashboard stats failed:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Instructions for frontend:');
    console.log('1. Open your browser and go to http://localhost:5173');
    console.log('2. Login with: runners.leb@gmail.com / admin123');
    console.log('3. Navigate to the Cashbox page');
    console.log('4. You should see the new interface without errors');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Server is not running. Start it with:');
      console.log('cd server && node index.js');
    } else if (error.response?.status === 401) {
      console.log('\n💡 Authentication failed. Check credentials or database.');
    }
  }
}

if (require.main === module) {
  testLogin();
}

module.exports = { testLogin };
