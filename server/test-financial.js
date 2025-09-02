const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test the financial summary endpoint specifically
async function testFinancial() {
  try {
    console.log('🧪 Testing Financial Summary Endpoint...\n');

    // Login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    
    const authToken = loginResponse.data.data.token;
    console.log('✅ Login successful');

    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Test financial summary
    console.log('1️⃣ Testing financial summary...');
    try {
      const response = await api.get('/dashboard/financial-summary');
      if (response.data.success) {
        console.log('✅ Financial summary successful');
        console.log('💵 Data:', response.data.data);
      } else {
        console.log('❌ Financial summary failed:', response.data.message);
      }
    } catch (error) {
      console.log('❌ Financial summary error:', error.response?.data?.message || error.message);
      if (error.response?.data?.error) {
        console.log('🔍 Detailed error:', error.response.data.error);
      }
    }

    console.log('\n🎉 Financial test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFinancial();
