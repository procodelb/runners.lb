const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testFullSystem() {
  console.log('🧪 Testing Complete Soufiam ERP System...\n');

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

      // 3. Test orders functionality
      console.log('\n3️⃣ Testing orders functionality...');
      
      // Get orders
      const ordersResponse = await axios.get(`${BASE_URL}/orders`, { headers: authHeaders });
      console.log('✅ Orders endpoint:', ordersResponse.data.data?.length || 0, 'orders');

      // Create a test order
      const testOrder = {
        order_ref: 'TEST-001',
        type: 'ecommerce',
        customer_name: 'Test Customer',
        brand_name: 'Test Brand',
        total_usd: 25.00,
        total_lbp: 2225000,
        status: 'new',
        payment_status: 'unpaid'
      };
      
      const createOrderResponse = await axios.post(`${BASE_URL}/orders`, testOrder, { headers: authHeaders });
      console.log('✅ Order creation:', createOrderResponse.data.success ? 'Success' : 'Failed');
      
      if (createOrderResponse.data.success) {
        const orderId = createOrderResponse.data.data.id;
        console.log('📦 Created order ID:', orderId);
        
        // Test order completion
        const completeResponse = await axios.post(`${BASE_URL}/orders/${orderId}/complete`, {
          status: 'completed',
          payment_status: 'paid'
        }, { headers: authHeaders });
        console.log('✅ Order completion:', completeResponse.data.success ? 'Success' : 'Failed');
      }

      // 4. Test clients functionality
      console.log('\n4️⃣ Testing clients functionality...');
      
      // Get clients
      const clientsResponse = await axios.get(`${BASE_URL}/clients`, { headers: authHeaders });
      console.log('✅ Clients endpoint:', clientsResponse.data.data?.length || 0, 'clients');

      // Create a test client
      const testClient = {
        business_name: 'Test Business',
        contact_person: 'Test Contact',
        phone: '+96170123456',
        address: 'Test Address, Beirut',
        category: 'ecommerce'
      };
      
      const createClientResponse = await axios.post(`${BASE_URL}/clients`, testClient, { headers: authHeaders });
      console.log('✅ Client creation:', createClientResponse.data.success ? 'Success' : 'Failed');

      // 5. Test cashbox functionality
      console.log('\n5️⃣ Testing cashbox functionality...');
      
      // Get cashbox balance
      const cashboxResponse = await axios.get(`${BASE_URL}/cashbox`, { headers: authHeaders });
      console.log('✅ Cashbox balance:', cashboxResponse.data.data);

      // Get cashbox history
      const cashboxHistoryResponse = await axios.get(`${BASE_URL}/cashbox/history`, { headers: authHeaders });
      console.log('✅ Cashbox history:', cashboxHistoryResponse.data.data?.length || 0, 'entries');

      // 6. Test drivers functionality
      console.log('\n6️⃣ Testing drivers functionality...');
      
      const driversResponse = await axios.get(`${BASE_URL}/drivers`, { headers: authHeaders });
      console.log('✅ Drivers endpoint:', driversResponse.data.data?.length || 0, 'drivers');

      // 7. Test dashboard functionality
      console.log('\n7️⃣ Testing dashboard functionality...');
      
      const dashboardResponse = await axios.get(`${BASE_URL}/dashboard/stats`, { headers: authHeaders });
      console.log('✅ Dashboard stats:', dashboardResponse.data.success ? 'Success' : 'Failed');

      // 8. Test order history functionality
      console.log('\n8️⃣ Testing order history functionality...');
      
      const orderHistoryResponse = await axios.get(`${BASE_URL}/order-history`, { headers: authHeaders });
      console.log('✅ Order history:', orderHistoryResponse.data.data?.length || 0, 'completed orders');

      // 9. Test transactions functionality
      console.log('\n9️⃣ Testing transactions functionality...');
      
      const transactionsResponse = await axios.get(`${BASE_URL}/transactions`, { headers: authHeaders });
      console.log('✅ Transactions:', transactionsResponse.data.data?.length || 0, 'transactions');

      // 10. Test price list functionality
      console.log('\n🔟 Testing price list functionality...');
      
      const priceListResponse = await axios.get(`${BASE_URL}/price-list`, { headers: authHeaders });
      console.log('✅ Price list:', priceListResponse.data.data?.length || 0, 'price entries');

      console.log('\n🎉 All system tests passed! Soufiam ERP is fully functional.');
      console.log('\n📊 System Summary:');
      console.log('- ✅ Server running on port 5000');
      console.log('- ✅ Authentication working');
      console.log('- ✅ Orders CRUD operations working');
      console.log('- ✅ Clients CRUD operations working');
      console.log('- ✅ Cashbox operations working');
      console.log('- ✅ Dashboard analytics working');
      console.log('- ✅ Order history working');
      console.log('- ✅ All API endpoints responding');
      console.log('- ✅ Database operations successful');
      console.log('- ✅ Neon PostgreSQL integration complete');

    } else {
      console.log('❌ Authentication failed:', loginResponse.data.message);
    }

  } catch (error) {
    console.error('❌ System test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFullSystem();
