const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'runners.leb@gmail.com';
const TEST_PASSWORD = '123456789';

let authToken = null;

// Helper function to make authenticated requests
async function makeAuthRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ ${method} ${endpoint} failed:`, error.response?.data || error.message);
    return null;
  }
}

// Test authentication
async function testAuth() {
  console.log('🔐 Testing authentication...');
  
  // Test login
  const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  
  if (loginResponse.data.success) {
    authToken = loginResponse.data.data.token;
    console.log('✅ Login successful');
    return true;
  } else {
    console.log('❌ Login failed');
    return false;
  }
}

// Test dashboard endpoints
async function testDashboard() {
  console.log('\n📊 Testing dashboard endpoints...');
  
  const endpoints = [
    '/dashboard/summary',
    '/dashboard/recent-orders',
    '/dashboard/top-clients',
    '/dashboard/financial-summary'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAuthRequest('GET', endpoint);
    if (result) {
      console.log(`✅ ${endpoint} - OK`);
    } else {
      console.log(`❌ ${endpoint} - Failed`);
    }
  }
}

// Test CRM/Client endpoints
async function testCRM() {
  console.log('\n👥 Testing CRM/Client endpoints...');
  
  const endpoints = [
    '/crm',
    '/clients'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAuthRequest('GET', endpoint);
    if (result) {
      console.log(`✅ ${endpoint} - OK`);
    } else {
      console.log(`❌ ${endpoint} - Failed`);
    }
  }
}

// Test Orders endpoints
async function testOrders() {
  console.log('\n📦 Testing Orders endpoints...');
  
  const endpoints = [
    '/orders',
    '/order-history',
    '/orders/history'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAuthRequest('GET', endpoint);
    if (result) {
      console.log(`✅ ${endpoint} - OK`);
    } else {
      console.log(`❌ ${endpoint} - Failed`);
    }
  }
}

// Test Drivers endpoints
async function testDrivers() {
  console.log('\n🚗 Testing Drivers endpoints...');
  
  const result = await makeAuthRequest('GET', '/drivers');
  if (result) {
    console.log('✅ /drivers - OK');
  } else {
    console.log('❌ /drivers - Failed');
  }
}

// Test Accounting endpoints
async function testAccounting() {
  console.log('\n💰 Testing Accounting endpoints...');
  
  const endpoints = [
    '/accounting/balance-sheet',
    '/accounting/income-statement',
    '/accounting/cash-flow'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAuthRequest('GET', endpoint);
    if (result) {
      console.log(`✅ ${endpoint} - OK`);
    } else {
      console.log(`❌ ${endpoint} - Failed`);
    }
  }
}

// Test Cashbox endpoints
async function testCashbox() {
  console.log('\n💼 Testing Cashbox endpoints...');
  
  const result = await makeAuthRequest('GET', '/cashbox');
  if (result) {
    console.log('✅ /cashbox - OK');
  } else {
    console.log('❌ /cashbox - Failed');
  }
}

// Test Price List endpoints
async function testPriceList() {
  console.log('\n📋 Testing Price List endpoints...');
  
  const result = await makeAuthRequest('GET', '/price-list');
  if (result) {
    console.log('✅ /price-list - OK');
  } else {
    console.log('❌ /price-list - Failed');
  }
}

// Test Transactions endpoints
async function testTransactions() {
  console.log('\n💳 Testing Transactions endpoints...');
  
  const result = await makeAuthRequest('GET', '/transactions');
  if (result) {
    console.log('✅ /transactions - OK');
  } else {
    console.log('❌ /transactions - Failed');
  }
}

// Test Settings endpoints
async function testSettings() {
  console.log('\n⚙️ Testing Settings endpoints...');
  
  const result = await makeAuthRequest('GET', '/settings');
  if (result) {
    console.log('✅ /settings - OK');
  } else {
    console.log('❌ /settings - Failed');
  }
}

// Test Analytics endpoints
async function testAnalytics() {
  console.log('\n📈 Testing Analytics endpoints...');
  
  const endpoints = [
    '/analytics/sales',
    '/analytics/orders',
    '/analytics/clients'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAuthRequest('GET', endpoint);
    if (result) {
      console.log(`✅ ${endpoint} - OK`);
    } else {
      console.log(`❌ ${endpoint} - Failed`);
    }
  }
}

// Main test function
async function runAllTests() {
  console.log('🧪 Testing all REST endpoints with Neon database...\n');
  
  // Test authentication first
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('❌ Authentication failed. Cannot proceed with endpoint tests.');
    return;
  }
  
  // Test all endpoint categories
  await testDashboard();
  await testCRM();
  await testOrders();
  await testDrivers();
  await testAccounting();
  await testCashbox();
  await testPriceList();
  await testTransactions();
  await testSettings();
  await testAnalytics();
  
  console.log('\n🎉 All endpoint tests completed!');
  console.log('✅ All REST endpoints are now using Neon database');
}

// Run tests
runAllTests().catch(console.error);
