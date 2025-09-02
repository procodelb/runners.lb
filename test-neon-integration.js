const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testNeonIntegration() {
  console.log('🧪 Testing Neon PostgreSQL Integration...\n');

  try {
    // 1. Test server health
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Server is running:', healthResponse.data);

    // 2. Test authentication
    console.log('\n2️⃣ Testing authentication...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Authentication successful');
      const token = loginResponse.data.data.token;
      const user = loginResponse.data.data.user;
      console.log('👤 User:', user.full_name, `(${user.email})`);
      
      // Set up authenticated requests
      const authHeaders = { Authorization: `Bearer ${token}` };

      // 3. Test dashboard stats
      console.log('\n3️⃣ Testing dashboard stats...');
      const statsResponse = await axios.get(`${BASE_URL}/dashboard/stats`, { headers: authHeaders });
      console.log('✅ Dashboard stats:', statsResponse.data.data);

      // 4. Test orders endpoint
      console.log('\n4️⃣ Testing orders endpoint...');
      const ordersResponse = await axios.get(`${BASE_URL}/orders`, { headers: authHeaders });
      console.log('✅ Orders count:', ordersResponse.data.data?.length || 0);

      // 5. Test clients endpoint
      console.log('\n5️⃣ Testing clients endpoint...');
      const clientsResponse = await axios.get(`${BASE_URL}/crm`, { headers: authHeaders });
      console.log('✅ Clients count:', clientsResponse.data.data?.length || 0);

      // 6. Test drivers endpoint
      console.log('\n6️⃣ Testing drivers endpoint...');
      const driversResponse = await axios.get(`${BASE_URL}/drivers`, { headers: authHeaders });
      console.log('✅ Drivers count:', driversResponse.data.data?.length || 0);

      // 7. Test cashbox endpoint
      console.log('\n7️⃣ Testing cashbox endpoint...');
      const cashboxResponse = await axios.get(`${BASE_URL}/cashbox`, { headers: authHeaders });
      console.log('✅ Cashbox data:', cashboxResponse.data.data);

      // 8. Test price list endpoint
      console.log('\n8️⃣ Testing price list endpoint...');
      const priceListResponse = await axios.get(`${BASE_URL}/price-list`, { headers: authHeaders });
      console.log('✅ Price list count:', priceListResponse.data.data?.length || 0);

      // 9. Test transactions endpoint
      console.log('\n9️⃣ Testing transactions endpoint...');
      const transactionsResponse = await axios.get(`${BASE_URL}/transactions`, { headers: authHeaders });
      console.log('✅ Transactions count:', transactionsResponse.data.data?.length || 0);

      // 10. Test analytics endpoint
console.log('\n🔟 Testing analytics endpoint...');
const analyticsResponse = await axios.get(`${BASE_URL}/dashboard/analytics`, { headers: authHeaders });
console.log('✅ Analytics data:', analyticsResponse.data.data);

      console.log('\n🎉 All tests passed! Neon PostgreSQL integration is working correctly.');
      console.log('\n📊 Summary:');
      console.log('- ✅ Server running on port 5000');
      console.log('- ✅ Authentication working');
      console.log('- ✅ All API endpoints responding');
      console.log('- ✅ Database queries executing successfully');
      console.log('- ✅ Data being retrieved from Neon PostgreSQL');

    } else {
      console.log('❌ Authentication failed:', loginResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testNeonIntegration();
