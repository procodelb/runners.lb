const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@test.com',
  password: 'admin123'
};

let authToken = '';
let testResults = [];

// Helper functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
  console.log(logMessage);
  testResults.push({ timestamp, type, message });
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status 
    };
  }
};

// Test functions
const testAuthentication = async () => {
  log('Testing authentication...');
  
  const loginResult = await makeRequest('POST', '/api/auth/login', TEST_USER);
  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    log('✅ Authentication successful', 'success');
    return true;
  } else {
    log('❌ Authentication failed', 'error');
    return false;
  }
};

const testBatchOrderTemplate = async () => {
  log('Testing batch order template endpoint...');
  
  const result = await makeRequest('GET', '/api/orders/batch/template');
  if (result.success && result.data.data) {
    log('✅ Batch order template retrieved successfully', 'success');
    log(`Template has ${result.data.data.headers.length} columns`, 'info');
    return true;
  } else {
    log('❌ Failed to retrieve batch order template', 'error');
    return false;
  }
};

const testBatchOrderValidation = async () => {
  log('Testing batch order validation...');
  
  const testOrders = [
    {
      customer_name: 'Test Customer 1',
      brand_name: 'Test Brand',
      type: 'ecommerce',
      total_usd: 25.00,
      total_lbp: 0,
      status: 'new',
      payment_status: 'unpaid',
      prepaid_status: 'not_prepaid'
    },
    {
      customer_name: 'Test Customer 2',
      brand_name: 'Test Brand 2',
      type: 'instant',
      total_usd: 15.00,
      total_lbp: 0,
      status: 'new',
      payment_status: 'prepaid',
      prepaid_status: 'prepaid'
    }
  ];
  
  const result = await makeRequest('POST', '/api/orders/batch/validate', { orders: testOrders });
  if (result.success && result.data.data) {
    log('✅ Batch order validation successful', 'success');
    log(`Validated ${result.data.data.summary.total} orders`, 'info');
    return true;
  } else {
    log('❌ Batch order validation failed', 'error');
    return false;
  }
};

const testBatchOrderCreation = async () => {
  log('Testing batch order creation...');
  
  const testOrders = [
    {
      customer_name: 'Batch Test Customer 1',
      brand_name: 'Batch Test Brand',
      type: 'ecommerce',
      total_usd: 30.00,
      total_lbp: 0,
      status: 'new',
      payment_status: 'unpaid',
      prepaid_status: 'not_prepaid',
      notes: 'Batch test order 1'
    },
    {
      customer_name: 'Batch Test Customer 2',
      brand_name: 'Batch Test Brand 2',
      type: 'instant',
      total_usd: 20.00,
      total_lbp: 0,
      status: 'new',
      payment_status: 'prepaid',
      prepaid_status: 'prepaid',
      notes: 'Batch test order 2'
    }
  ];
  
  const result = await makeRequest('POST', '/api/orders/batch', { orders: testOrders });
  if (result.success && result.data.data) {
    log('✅ Batch order creation successful', 'success');
    log(`Created ${result.data.data.summary.successful} orders`, 'info');
    return true;
  } else {
    log('❌ Batch order creation failed', 'error');
    return false;
  }
};

const testAccountingEndpoints = async () => {
  log('Testing accounting endpoints...');
  
  const endpoints = [
    '/api/accounting/clients',
    '/api/accounting/drivers',
    '/api/accounting/thirdparty'
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    const result = await makeRequest('GET', endpoint);
    if (result.success) {
      log(`✅ ${endpoint} endpoint working`, 'success');
    } else {
      log(`❌ ${endpoint} endpoint failed`, 'error');
      allPassed = false;
    }
  }
  
  return allPassed;
};

const testExportEndpoints = async () => {
  log('Testing export endpoints...');
  
  const exportTypes = ['csv', 'excel', 'pdf'];
  const entityTypes = ['clients', 'drivers', 'third_parties'];
  
  let allPassed = true;
  
  for (const entityType of entityTypes) {
    for (const exportType of exportTypes) {
      const result = await makeRequest('GET', `/api/accounting/export/${exportType}?type=${entityType}`);
      if (result.success || result.status === 200) {
        log(`✅ Export ${exportType} for ${entityType} working`, 'success');
      } else {
        log(`❌ Export ${exportType} for ${entityType} failed`, 'error');
        allPassed = false;
      }
    }
  }
  
  return allPassed;
};

const testDatabaseSchema = async () => {
  log('Testing database schema updates...');
  
  // Test if new columns exist by trying to create an order with new fields
  const testOrder = {
    customer_name: 'Schema Test Customer',
    brand_name: 'Schema Test Brand',
    type: 'ecommerce',
    total_usd: 25.00,
    total_lbp: 0,
    status: 'new',
    payment_status: 'prepaid',
    prepaid_status: 'prepaid',
    notes: 'Testing new schema fields'
  };
  
  const result = await makeRequest('POST', '/api/orders', testOrder);
  if (result.success) {
    log('✅ Database schema supports new fields', 'success');
    return true;
  } else {
    log('❌ Database schema may not be updated', 'error');
    return false;
  }
};

const testThirdPartyEndpoints = async () => {
  log('Testing third party endpoints...');
  
  // Test creating a third party
  const thirdPartyData = {
    name: 'Test Third Party',
    contact_person: 'Test Contact',
    phone: '+961 70 123456',
    email: 'test@thirdparty.com',
    address: 'Test Address',
    commission_rate: 5.00
  };
  
  const createResult = await makeRequest('POST', '/api/third-parties', thirdPartyData);
  if (createResult.success) {
    log('✅ Third party creation successful', 'success');
    
    // Test getting third parties
    const getResult = await makeRequest('GET', '/api/third-parties');
    if (getResult.success) {
      log('✅ Third party retrieval successful', 'success');
      return true;
    }
  }
  
  log('❌ Third party endpoints failed', 'error');
  return false;
};

// Main test runner
const runTests = async () => {
  log('🚀 Starting ERP Redesign Tests', 'info');
  log('=' * 50, 'info');
  
  const tests = [
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Database Schema', fn: testDatabaseSchema },
    { name: 'Batch Order Template', fn: testBatchOrderTemplate },
    { name: 'Batch Order Validation', fn: testBatchOrderValidation },
    { name: 'Batch Order Creation', fn: testBatchOrderCreation },
    { name: 'Accounting Endpoints', fn: testAccountingEndpoints },
    { name: 'Export Endpoints', fn: testExportEndpoints },
    { name: 'Third Party Endpoints', fn: testThirdPartyEndpoints }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    log(`\n🧪 Running test: ${test.name}`, 'info');
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
        log(`✅ ${test.name} PASSED`, 'success');
      } else {
        log(`❌ ${test.name} FAILED`, 'error');
      }
    } catch (error) {
      log(`❌ ${test.name} ERROR: ${error.message}`, 'error');
    }
  }
  
  log('\n' + '=' * 50, 'info');
  log(`🎯 Test Results: ${passedTests}/${totalTests} tests passed`, 'info');
  
  if (passedTests === totalTests) {
    log('🎉 All tests passed! ERP redesign is working correctly.', 'success');
  } else {
    log('⚠️ Some tests failed. Please check the implementation.', 'warning');
  }
  
  // Save test results
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  log(`📊 Test results saved to: ${reportPath}`, 'info');
  
  return passedTests === totalTests;
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      log(`💥 Test runner error: ${error.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { runTests, testResults };
