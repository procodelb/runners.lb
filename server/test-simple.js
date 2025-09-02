const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Simple test to debug issues
async function testSimple() {
  try {
    console.log('🧪 Simple Test to Debug Issues...\n');

    // Login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    
    const authToken = loginResponse.data.data.token;
    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Test basic endpoints
    console.log('1️⃣ Testing basic dashboard...');
    try {
      const response = await api.get('/dashboard/stats');
      console.log('✅ Basic dashboard working');
    } catch (error) {
      console.log('❌ Basic dashboard error:', error.response?.data?.message || error.message);
    }

    // Test analytics dashboard
    console.log('\n2️⃣ Testing analytics dashboard...');
    try {
      const response = await api.get('/analytics/dashboard');
      console.log('✅ Analytics dashboard working');
    } catch (error) {
      console.log('❌ Analytics dashboard error:', error.response?.data?.message || error.message);
    }

    // Test financial summary
    console.log('\n3️⃣ Testing financial summary...');
    try {
      const response = await api.get('/dashboard/financial-summary');
      console.log('✅ Financial summary working');
    } catch (error) {
      console.log('❌ Financial summary error:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Simple test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimple();
