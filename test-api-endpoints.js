const https = require('https');
const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER = {
  email: 'runners.lb@gmail.com',
  password: '123456789'
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test functions
async function testHealthEndpoint() {
  console.log('🔍 Testing Health Endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    console.log(`✅ Health endpoint: ${response.status} - ${JSON.stringify(response.data)}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Health endpoint failed: ${error.message}`);
    return false;
  }
}

async function testLogin() {
  console.log('🔍 Testing Login...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: TEST_USER
    });
    console.log(`✅ Login: ${response.status} - ${response.data.message || 'Success'}`);
    console.log(`   - Token: ${response.data.data?.token ? 'Received' : 'Not found'}`);
    return response.data.data?.token;
  } catch (error) {
    console.log(`❌ Login failed: ${error.message}`);
    return null;
  }
}

async function testDashboardStats(token) {
  console.log('🔍 Testing Dashboard Stats...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ Dashboard stats: ${response.status}`);
    console.log(`   - Total Orders: ${response.data.data?.totalOrders || 'N/A'}`);
    console.log(`   - Total Clients: ${response.data.data?.totalClients || 'N/A'}`);
    console.log(`   - Active Drivers: ${response.data.data?.activeDrivers || 'N/A'}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Dashboard stats failed: ${error.message}`);
    return false;
  }
}

async function testOrdersEndpoint(token) {
  console.log('🔍 Testing Orders Endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ Orders endpoint: ${response.status}`);
    console.log(`   - Orders count: ${response.data.data?.length || 0}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Orders endpoint failed: ${error.message}`);
    return false;
  }
}

async function testBatchOrdersEndpoint(token) {
  console.log('🔍 Testing Batch Orders Endpoint...');
  try {
    const testOrder = {
      customer_name: 'Test Customer',
      customer_phone: '1234567890',
      location_text: 'Test Location',
      total_usd: 10.00,
      delivery_mode: 'in_house',
      prepaid_status: 'unpaid',
      status: 'new',
      payment_status: 'unpaid'
    };
    
    const response = await makeRequest(`${BASE_URL}/api/orders/batch`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { orders: [testOrder] }
    });
    console.log(`✅ Batch orders: ${response.status}`);
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.log(`❌ Batch orders failed: ${error.message}`);
    return false;
  }
}

async function testAccountingEndpoint(token) {
  console.log('🔍 Testing Accounting Endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/accounting/clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ Accounting clients: ${response.status}`);
    console.log(`   - Clients count: ${response.data.data?.length || 0}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Accounting endpoint failed: ${error.message}`);
    return false;
  }
}

async function testCashboxEndpoint(token) {
  console.log('🔍 Testing Cashbox Endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/cashbox`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✅ Cashbox: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Cashbox endpoint failed: ${error.message}`);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API Integration Tests...\n');
  
  const results = {
    health: false,
    login: false,
    dashboard: false,
    orders: false,
    batchOrders: false,
    accounting: false,
    cashbox: false
  };
  
  // Test health endpoint
  results.health = await testHealthEndpoint();
  console.log('');
  
  if (!results.health) {
    console.log('❌ Health check failed. Server may not be running.');
    return;
  }
  
  // Test login
  const token = await testLogin();
  results.login = !!token;
  console.log('');
  
  if (!token) {
    console.log('❌ Login failed. Cannot test authenticated endpoints.');
    return;
  }
  
  // Test authenticated endpoints
  results.dashboard = await testDashboardStats(token);
  console.log('');
  
  results.orders = await testOrdersEndpoint(token);
  console.log('');
  
  results.batchOrders = await testBatchOrdersEndpoint(token);
  console.log('');
  
  results.accounting = await testAccountingEndpoint(token);
  console.log('');
  
  results.cashbox = await testCashboxEndpoint(token);
  console.log('');
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the server logs.');
  }
}

// Run the tests
runTests().catch(console.error);
