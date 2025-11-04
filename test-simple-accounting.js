const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Simple test to check accounting endpoint
async function testSimpleAccounting() {
  console.log('🧪 Testing Simple Accounting...\n');

  try {
    // Login first
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@soufian.com',
      password: 'admin123'
    });
    const authToken = loginResponse.data.data.token;
    console.log('✅ Authentication successful');

    // Test accounting clients endpoint
    console.log('\n2️⃣ Testing accounting clients endpoint...');
    try {
      const accountingResponse = await axios.get(`${BASE_URL}/accounting/clients`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Accounting clients endpoint working');
      console.log('Response data length:', accountingResponse.data.data?.length || 0);
    } catch (error) {
      console.error('❌ Accounting clients endpoint failed:', error.response?.data || error.message);
    }

    // Test accounting overview endpoint
    console.log('\n3️⃣ Testing accounting overview endpoint...');
    try {
      const overviewResponse = await axios.get(`${BASE_URL}/accounting/overview`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Accounting overview endpoint working');
      console.log('Response data length:', overviewResponse.data.data?.length || 0);
    } catch (error) {
      console.error('❌ Accounting overview endpoint failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSimpleAccounting();
