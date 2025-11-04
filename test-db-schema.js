const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test to check database schema
async function testDatabaseSchema() {
  console.log('🧪 Testing Database Schema...\n');

  try {
    // Login first
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@soufian.com',
      password: 'admin123'
    });
    const authToken = loginResponse.data.data.token;
    console.log('✅ Authentication successful');

    // Test getting a client to see what fields are available
    console.log('\n2️⃣ Testing client data structure...');
    try {
      const clientsResponse = await axios.get(`${BASE_URL}/clients?limit=1`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Clients endpoint working');
      if (clientsResponse.data.data && clientsResponse.data.data.length > 0) {
        const client = clientsResponse.data.data[0];
        console.log('Client fields:', Object.keys(client));
        console.log('Client data sample:', {
          id: client.id,
          business_name: client.business_name,
          old_balance_usd: client.old_balance_usd,
          account_balance_usd: client.account_balance_usd,
          old_balance_lbp: client.old_balance_lbp,
          account_balance_lbp: client.account_balance_lbp
        });
      }
    } catch (error) {
      console.error('❌ Clients endpoint failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testDatabaseSchema();
