const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

console.log('🧪 Starting comprehensive ERP system test...');
console.log(`🔗 Backend URL: ${BACKEND_URL}`);
console.log(`🔗 Frontend URL: ${FRONTEND_URL}`);

// Test utilities
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`✅ ${name}`);
    testResults.passed++;
  } else {
    console.log(`❌ ${name}`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
      testResults.errors.push({ name, error: error.message || error });
    }
    testResults.failed++;
  }
}

// Test 1: Database Connection
async function testDatabaseConnection() {
  try {
    const response = await api.get('/health');
    logTest('Database Connection', response.status === 200);
  } catch (error) {
    logTest('Database Connection', false, error);
  }
}

// Test 2: Authentication
async function testAuthentication() {
  try {
    // Test login
    const loginResponse = await api.post('/auth/login', {
      email: 'admin@soufian.com',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      logTest('Authentication - Login', true);
      
      // Test protected route
      const meResponse = await api.get('/auth/me');
      logTest('Authentication - Protected Route', meResponse.data.success);
    } else {
      logTest('Authentication - Login', false, 'Login failed');
    }
  } catch (error) {
    logTest('Authentication', false, error);
  }
}

// Test 3: Cashbox Operations
async function testCashbox() {
  try {
    // Test get balance
    const balanceResponse = await api.get('/cashbox');
    logTest('Cashbox - Get Balance', balanceResponse.data.success);
    
    // Test add entry
    const entryResponse = await api.post('/cashbox/entry', {
      type: 'cash_in',
      amount_usd: 100,
      amount_lbp: 8900000,
      description: 'Test entry'
    });
    logTest('Cashbox - Add Entry', entryResponse.data.success);
    
    // Test get history
    const historyResponse = await api.get('/cashbox/history');
    logTest('Cashbox - Get History', historyResponse.data.success);
  } catch (error) {
    logTest('Cashbox Operations', false, error);
  }
}

// Test 4: Transactions
async function testTransactions() {
  try {
    const response = await api.get('/transactions');
    logTest('Transactions - Get List', response.data.success);
  } catch (error) {
    logTest('Transactions', false, error);
  }
}

// Test 5: Order History
async function testOrderHistory() {
  try {
    const response = await api.get('/orders/history');
    logTest('Order History - Get List', response.data.success);
  } catch (error) {
    testOrderHistory('Order History', false, error);
  }
}

// Test 6: CRM/Clients
async function testCRM() {
  try {
    const response = await api.get('/crm');
    logTest('CRM - Get Clients', response.data.success);
  } catch (error) {
    logTest('CRM', false, error);
  }
}

// Test 7: Orders
async function testOrders() {
  try {
    const response = await api.get('/orders');
    logTest('Orders - Get List', response.data.success);
  } catch (error) {
    logTest('Orders', false, error);
  }
}

// Test 8: Drivers
async function testDrivers() {
  try {
    const response = await api.get('/drivers');
    logTest('Drivers - Get List', response.data.success);
  } catch (error) {
    logTest('Drivers', false, error);
  }
}

// Test 9: Price List
async function testPriceList() {
  try {
    const response = await api.get('/price-list');
    logTest('Price List - Get List', response.data.success);
  } catch (error) {
    logTest('Price List', false, error);
  }
}

// Test 10: Dashboard
async function testDashboard() {
  try {
    const response = await api.get('/dashboard/stats');
    logTest('Dashboard - Get Stats', response.data.success);
  } catch (error) {
    logTest('Dashboard', false, error);
  }
}

// Test 11: Frontend Health Check
async function testFrontend() {
  try {
    const response = await axios.get(`${FRONTEND_URL}`, { timeout: 5000 });
    logTest('Frontend - Health Check', response.status === 200);
  } catch (error) {
    logTest('Frontend - Health Check', false, error);
  }
}

// Test 12: Database Schema Fixes
async function testDatabaseSchema() {
  try {
    // Test if cashbox has required columns
    const balanceResponse = await api.get('/cashbox');
    const hasInitialBalance = balanceResponse.data.data.hasOwnProperty('initial_balance_usd');
    logTest('Database Schema - Cashbox Columns', hasInitialBalance);
  } catch (error) {
    logTest('Database Schema', false, error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🔧 Running Database Tests...');
  await testDatabaseConnection();
  await testDatabaseSchema();
  
  console.log('\n🔐 Running Authentication Tests...');
  await testAuthentication();
  
  console.log('\n💰 Running Cashbox Tests...');
  await testCashbox();
  
  console.log('\n💳 Running Transactions Tests...');
  await testTransactions();
  
  console.log('\n📋 Running Order History Tests...');
  await testOrderHistory();
  
  console.log('\n👥 Running CRM Tests...');
  await testCRM();
  
  console.log('\n📦 Running Orders Tests...');
  await testOrders();
  
  console.log('\n🚚 Running Drivers Tests...');
  await testDrivers();
  
  console.log('\n📋 Running Price List Tests...');
  await testPriceList();
  
  console.log('\n📊 Running Dashboard Tests...');
  await testDashboard();
  
  console.log('\n🌐 Running Frontend Tests...');
  await testFrontend();
  
  // Print summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(({ name, error }) => {
      console.log(`   ${name}: ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! The ERP system is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
}

// Run tests
runAllTests().catch(console.error);
