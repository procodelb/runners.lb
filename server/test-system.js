const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test the system
async function testSystem() {
  try {
    console.log('🧪 Testing Soufian ERP System...\n');

    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    try {
      const healthResponse = await axios.get(`${API_BASE.replace('/api', '')}/health`);
      console.log('✅ Health check successful:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }

    // Test 2: Login
    console.log('\n2️⃣ Testing login...');
    let authToken = null;
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      });
      
      if (loginResponse.data.success) {
        authToken = loginResponse.data.data.token;
        console.log('✅ Login successful:', loginResponse.data.message);
        console.log('👤 User:', loginResponse.data.data.user.email);
      } else {
        console.log('❌ Login failed:', loginResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Login error:', error.response?.data?.message || error.message);
    }

    if (!authToken) {
      console.log('❌ Cannot continue without authentication token');
      return;
    }

    // Set up axios with auth header
    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Test 3: Get current user
    console.log('\n3️⃣ Testing get current user...');
    try {
      const meResponse = await api.get('/auth/me');
      if (meResponse.data.success) {
        console.log('✅ Get current user successful:', meResponse.data.data.email);
      } else {
        console.log('❌ Get current user failed:', meResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get current user error:', error.response?.data?.message || error.message);
    }

    // Test 4: Dashboard stats
    console.log('\n4️⃣ Testing dashboard stats...');
    try {
      const dashboardResponse = await api.get('/dashboard/stats');
      if (dashboardResponse.data.success) {
        console.log('✅ Dashboard stats successful:', dashboardResponse.data.data);
      } else {
        console.log('❌ Dashboard stats failed:', dashboardResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Dashboard stats error:', error.response?.data?.message || error.message);
    }

    // Test 5: Get clients (CRM)
    console.log('\n5️⃣ Testing CRM (clients)...');
    try {
      const clientsResponse = await api.get('/crm');
      if (clientsResponse.data.success) {
        console.log('✅ Get clients successful:', clientsResponse.data.data?.length || 0, 'clients found');
      } else {
        console.log('❌ Get clients failed:', clientsResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get clients error:', error.response?.data?.message || error.message);
    }

    // Test 6: Get drivers
    console.log('\n6️⃣ Testing drivers...');
    try {
      const driversResponse = await api.get('/drivers');
      if (driversResponse.data.success) {
        console.log('✅ Get drivers successful:', driversResponse.data.data?.length || 0, 'drivers found');
      } else {
        console.log('❌ Get drivers failed:', driversResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get drivers error:', error.response?.data?.message || error.message);
    }

    // Test 7: Get orders
    console.log('\n7️⃣ Testing orders...');
    try {
      const ordersResponse = await api.get('/orders');
      if (ordersResponse.data.success) {
        console.log('✅ Get orders successful:', ordersResponse.data.data?.length || 0, 'orders found');
      } else {
        console.log('❌ Get orders failed:', ordersResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get orders error:', error.response?.data?.message || error.message);
    }

    // Test 8: Get transactions
    console.log('\n8️⃣ Testing transactions...');
    try {
      const transactionsResponse = await api.get('/transactions');
      if (transactionsResponse.data.success) {
        console.log('✅ Get transactions successful:', transactionsResponse.data.data?.length || 0, 'transactions found');
      } else {
        console.log('❌ Get transactions failed:', transactionsResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get transactions error:', error.response?.data?.message || error.message);
    }

    // Test 9: Get cashbox
    console.log('\n9️⃣ Testing cashbox...');
    try {
      const cashboxResponse = await api.get('/cashbox');
      if (cashboxResponse.data.success) {
        console.log('✅ Get cashbox successful:', cashboxResponse.data.data);
      } else {
        console.log('❌ Get cashbox failed:', cashboxResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get cashbox error:', error.response?.data?.message || error.message);
    }

    // Test 10: Get price list
    console.log('\n🔟 Testing price list...');
    try {
      const priceListResponse = await api.get('/price-list');
      if (priceListResponse.data.success) {
        console.log('✅ Get price list successful:', priceListResponse.data.data?.length || 0, 'prices found');
      } else {
        console.log('❌ Get price list failed:', priceListResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Get price list error:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 System test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSystem();
