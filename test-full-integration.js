const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const CLIENT_URL = 'http://localhost:5173';
let authToken = null;

async function testServerHealth() {
  console.log('🏥 Testing Server Health...');
  try {
    const response = await axios.get('http://localhost:5000/health');
    if (response.data.status === 'OK') {
      console.log('✅ Server is healthy');
      return true;
    } else {
      console.log('❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    return false;
  }
}

async function testClientHealth() {
  console.log('🏥 Testing Client Health...');
  try {
    const response = await axios.get(`${CLIENT_URL}`, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ Client is accessible');
      return true;
    } else {
      console.log('❌ Client health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Client health check failed:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('🗄️ Testing Database Connection...');
  try {
    const response = await axios.get(`${API_BASE}/health`);
    if (response.data.status === 'OK') {
      console.log('✅ Database connection working');
      return true;
    } else {
      console.log('❌ Database connection failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testAuthentication() {
  console.log('🔐 Testing Authentication...');
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'runners.leb@gmail.com',
      password: '123456789'
    });
    
    if (response.data.success) {
      authToken = response.data.data.token;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.log('❌ Authentication failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testCRUDOperations() {
  console.log('📝 Testing CRUD Operations...');
  
  // Test CREATE - Add a new client
  try {
    const newClient = {
      business_name: 'Test Company',
      contact_person: 'Test Person',
      phone: '+961 70 123 456',
      email: 'test@example.com',
      address: 'Test Address',
      business_type: 'Technology'
    };
    
    const createResponse = await axios.post(`${API_BASE}/crm`, newClient, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (createResponse.data.success) {
      console.log('✅ CREATE operation successful');
      const clientId = createResponse.data.data.id;
      
      // Test READ - Get the created client
      const readResponse = await axios.get(`${API_BASE}/crm/${clientId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (readResponse.data.success) {
        console.log('✅ READ operation successful');
        
        // Test UPDATE - Update the client
        const updateData = { ...newClient, business_name: 'Updated Test Company' };
        const updateResponse = await axios.put(`${API_BASE}/crm/${clientId}`, updateData, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (updateResponse.data.success) {
          console.log('✅ UPDATE operation successful');
          
          // Test DELETE - Delete the client
          const deleteResponse = await axios.delete(`${API_BASE}/crm/${clientId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          
          if (deleteResponse.data.success) {
            console.log('✅ DELETE operation successful');
            return true;
          } else {
            console.log('❌ DELETE operation failed');
            return false;
          }
        } else {
          console.log('❌ UPDATE operation failed');
          return false;
        }
      } else {
        console.log('❌ READ operation failed');
        return false;
      }
    } else {
      console.log('❌ CREATE operation failed');
      return false;
    }
  } catch (error) {
    console.log('❌ CRUD operations failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testBusinessLogic() {
  console.log('💼 Testing Business Logic...');
  
  try {
    // Test order creation with automatic calculations
    const newOrder = {
      client_id: 1,
      driver_id: 1,
      pickup_location: 'Beirut',
      delivery_location: 'Mount Lebanon',
      items: [
        { description: 'Test Item 1', quantity: 2, price_usd: 10.50 },
        { description: 'Test Item 2', quantity: 1, price_usd: 25.00 }
      ],
      notes: 'Test order for business logic validation'
    };
    
    const orderResponse = await axios.post(`${API_BASE}/orders`, newOrder, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (orderResponse.data.success) {
      console.log('✅ Order creation with business logic successful');
      
      // Verify automatic calculations
      const order = orderResponse.data.data;
      const expectedTotal = (2 * 10.50) + (1 * 25.00);
      const expectedLbp = expectedTotal * 89000; // Exchange rate
      
      if (Math.abs(order.total_usd - expectedTotal) < 0.01) {
        console.log('✅ Automatic USD calculation correct');
      } else {
        console.log('❌ Automatic USD calculation incorrect');
        return false;
      }
      
      if (Math.abs(order.total_lbp - expectedLbp) < 1000) { // Allow small rounding differences
        console.log('✅ Automatic LBP calculation correct');
      } else {
        console.log('❌ Automatic LBP calculation incorrect');
        return false;
      }
      
      // Clean up - delete the test order
      await axios.delete(`${API_BASE}/orders/${order.id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      return true;
    } else {
      console.log('❌ Order creation failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Business logic test failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testDataConsistency() {
  console.log('🔍 Testing Data Consistency...');
  
  try {
    // Test that all endpoints return consistent data formats
    const endpoints = [
      '/crm',
      '/orders',
      '/drivers',
      '/transactions',
      '/price-list',
      '/cashbox'
    ];
    
    for (const endpoint of endpoints) {
      const response = await axios.get(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.data.success && Array.isArray(response.data.data)) {
        console.log(`✅ ${endpoint} returns consistent array format`);
      } else if (response.data.success && typeof response.data.data === 'object') {
        console.log(`✅ ${endpoint} returns consistent object format`);
      } else {
        console.log(`❌ ${endpoint} returns inconsistent format`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Data consistency test failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function runFullIntegrationTest() {
  console.log('🚀 Starting Full Neon Integration Test...\n');
  
  const tests = [
    { name: 'Server Health', test: testServerHealth },
    { name: 'Client Health', test: testClientHealth },
    { name: 'Database Connection', test: testDatabaseConnection },
    { name: 'Authentication', test: testAuthentication },
    { name: 'CRUD Operations', test: testCRUDOperations },
    { name: 'Business Logic', test: testBusinessLogic },
    { name: 'Data Consistency', test: testDataConsistency }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} Test ---`);
    const success = await test.test();
    results.push({ name: test.name, success });
  }
  
  console.log('\n📊 Full Integration Test Results:');
  console.log('==================================');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 FULL SYSTEM INTEGRATION SUCCESSFUL!');
    console.log('✅ Neon database is fully integrated');
    console.log('✅ All ERP functions are working');
    console.log('✅ Business logic is consistent');
    console.log('✅ Frontend and backend are connected');
    console.log('✅ CRUD operations are functional');
    console.log('✅ Data formats are consistent');
  } else {
    console.log('⚠️ Some integration tests failed. Please check the errors above.');
  }
}

runFullIntegrationTest().catch(console.error);
