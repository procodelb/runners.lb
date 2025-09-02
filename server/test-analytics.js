const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test the analytics endpoints
async function testAnalytics() {
  try {
    console.log('🧪 Testing Analytics Endpoints...\n');

    // First, login to get auth token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }
    
    const authToken = loginResponse.data.data.token;
    console.log('✅ Login successful');

    // Set up axios with auth header
    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Test analytics dashboard
    console.log('\n2️⃣ Testing analytics dashboard...');
    try {
      const dashboardResponse = await api.get('/analytics/dashboard');
      if (dashboardResponse.data.success) {
        console.log('✅ Analytics dashboard successful');
        console.log('📊 Data structure:', Object.keys(dashboardResponse.data.data));
      } else {
        console.log('❌ Analytics dashboard failed:', dashboardResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Analytics dashboard error:', error.response?.data?.message || error.message);
    }

    // Test revenue analytics
    console.log('\n3️⃣ Testing revenue analytics...');
    try {
      const revenueResponse = await api.get('/analytics/revenue');
      if (revenueResponse.data.success) {
        console.log('✅ Revenue analytics successful');
        console.log('💰 Data structure:', Object.keys(revenueResponse.data.data));
      } else {
        console.log('❌ Revenue analytics failed:', revenueResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Revenue analytics error:', error.response?.data?.message || error.message);
    }

    // Test operational analytics
    console.log('\n4️⃣ Testing operational analytics...');
    try {
      const operationalResponse = await api.get('/analytics/operational');
      if (operationalResponse.data.success) {
        console.log('✅ Operational analytics successful');
        console.log('⚙️ Data structure:', Object.keys(operationalResponse.data.data));
      } else {
        console.log('❌ Operational analytics failed:', operationalResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Operational analytics error:', error.response?.data?.message || error.message);
    }

    // Test enhanced dashboard stats
    console.log('\n5️⃣ Testing enhanced dashboard stats...');
    try {
      const enhancedStatsResponse = await api.get('/dashboard/analytics');
      if (enhancedStatsResponse.data.success) {
        console.log('✅ Enhanced dashboard stats successful');
        console.log('📈 Data structure:', Object.keys(enhancedStatsResponse.data.data));
      } else {
        console.log('❌ Enhanced dashboard stats failed:', enhancedStatsResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Enhanced dashboard stats error:', error.response?.data?.message || error.message);
    }

    // Test financial summary
    console.log('\n6️⃣ Testing financial summary...');
    try {
      const financialResponse = await api.get('/dashboard/financial-summary');
      if (financialResponse.data.success) {
        console.log('✅ Financial summary successful');
        console.log('💵 Data structure:', Object.keys(financialResponse.data.data));
      } else {
        console.log('❌ Financial summary failed:', financialResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Financial summary error:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Analytics testing completed!');

  } catch (error) {
    console.error('❌ Analytics test failed:', error.message);
  }
}

// Run the test
testAnalytics();
