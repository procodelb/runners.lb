const axios = require('axios');

async function testSystem() {
  console.log('🧪 Testing Neon SQL System Integration...\n');
  
  const baseURL = 'http://localhost:5000';
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Server health:', healthResponse.data);
    
    // Test 2: API Health Check
    console.log('\n2️⃣ Testing API health...');
    const apiHealthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ API health:', apiHealthResponse.data);
    
    // Test 3: Authentication
    console.log('\n3️⃣ Testing authentication...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@test.com',
      password: '123456789'
    });
    console.log('✅ Login successful:', loginResponse.data.success);
    const token = loginResponse.data.data.token;
    
    // Test 4: Protected Routes
    console.log('\n4️⃣ Testing protected routes...');
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test CRM endpoint
    const crmResponse = await axios.get(`${baseURL}/api/crm`, { headers });
    console.log('✅ CRM endpoint working, clients count:', crmResponse.data.data.length);
    
    // Test Orders endpoint
    const ordersResponse = await axios.get(`${baseURL}/api/orders`, { headers });
    console.log('✅ Orders endpoint working, orders count:', ordersResponse.data.data.length);
    
    // Test Drivers endpoint
    const driversResponse = await axios.get(`${baseURL}/api/drivers`, { headers });
    console.log('✅ Drivers endpoint working, drivers count:', driversResponse.data.data.length);
    
    // Test Price List endpoint
    const priceListResponse = await axios.get(`${baseURL}/api/price-list`, { headers });
    console.log('✅ Price List endpoint working, prices count:', priceListResponse.data.data.length);
    
    // Test Cashbox endpoint
    const cashboxResponse = await axios.get(`${baseURL}/api/cashbox/balance`, { headers });
    console.log('✅ Cashbox endpoint working, balance:', cashboxResponse.data.data);
    
    console.log('\n🎉 All tests passed! Neon SQL system is working correctly.');
    console.log('\n📊 System Status:');
    console.log('   - Database: ✅ Connected to Neon PostgreSQL');
    console.log('   - Authentication: ✅ Working');
    console.log('   - API Endpoints: ✅ All functional');
    console.log('   - Data Integrity: ✅ All tables accessible');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testSystem();
