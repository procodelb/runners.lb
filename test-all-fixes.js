const axios = require('axios');
const { Pool } = require('pg');

// Configuration
const SERVER_URL = 'http://localhost:5000';
const API_BASE = `${SERVER_URL}/api`;
const TEST_USER = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';
let testResults = [];

// Test utilities
const logTest = (testName, status, message = '') => {
  const result = { testName, status, message, timestamp: new Date().toISOString() };
  testResults.push(result);
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${testName}: ${status} ${message ? `- ${message}` : ''}`);
  return result;
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000
    };

    if (data) {
      config.data = data;
    }

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 0
    };
  }
};

// Test 1: Server Health Check
const testServerHealth = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/health`, { timeout: 5000 });
    if (response.status === 200) {
      logTest('Server Health Check', 'PASS', 'Server is running and responding');
      return true;
    } else {
      logTest('Server Health Check', 'FAIL', `Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Server Health Check', 'FAIL', `Server not reachable: ${error.message}`);
    return false;
  }
};

// Test 2: Authentication
const testAuthentication = async () => {
  try {
    const response = await makeRequest('POST', '/auth/login', TEST_USER);
    if (response.success && response.data.success) {
      authToken = response.data.token || response.data.accessToken;
      logTest('Authentication', 'PASS', 'Successfully authenticated');
      return true;
    } else {
      logTest('Authentication', 'FAIL', 'Authentication failed');
      return false;
    }
  } catch (error) {
    logTest('Authentication', 'FAIL', `Authentication error: ${error.message}`);
    return false;
  }
};

// Test 3: Cashbox API
const testCashboxAPI = async () => {
  try {
    // Test cashbox balance
    const balanceResponse = await makeRequest('GET', '/cashbox');
    if (balanceResponse.success && balanceResponse.data.success) {
      logTest('Cashbox Balance API', 'PASS', 'Balance endpoint working');
    } else {
      logTest('Cashbox Balance API', 'FAIL', 'Balance endpoint failed');
    }

    // Test cashbox entries
    const entriesResponse = await makeRequest('GET', '/cashbox/entries');
    if (entriesResponse.success && entriesResponse.data.success) {
      const data = entriesResponse.data.data;
      if (Array.isArray(data)) {
        logTest('Cashbox Entries API', 'PASS', `Entries endpoint working, returned ${data.length} entries`);
      } else {
        logTest('Cashbox Entries API', 'FAIL', 'Entries endpoint did not return array');
      }
    } else {
      logTest('Cashbox Entries API', 'FAIL', 'Entries endpoint failed');
    }

    return true;
  } catch (error) {
    logTest('Cashbox API', 'FAIL', `Cashbox API error: ${error.message}`);
    return false;
  }
};

// Test 4: Order History API
const testOrderHistoryAPI = async () => {
  try {
    const response = await makeRequest('GET', '/orders/history');
    if (response.success && response.data.success) {
      const data = response.data.data;
      if (Array.isArray(data)) {
        logTest('Order History API', 'PASS', `Order history working, returned ${data.length} orders`);
      } else {
        logTest('Order History API', 'FAIL', 'Order history did not return array');
      }
    } else {
      logTest('Order History API', 'FAIL', `Order history failed: ${response.error?.message || 'Unknown error'}`);
    }
    return true;
  } catch (error) {
    logTest('Order History API', 'FAIL', `Order history error: ${error.message}`);
    return false;
  }
};

// Test 5: Transactions API
const testTransactionsAPI = async () => {
  try {
    const response = await makeRequest('GET', '/transactions');
    if (response.success && response.data.success) {
      const data = response.data.data;
      if (Array.isArray(data)) {
        logTest('Transactions API', 'PASS', `Transactions working, returned ${data.length} transactions`);
      } else {
        logTest('Transactions API', 'FAIL', 'Transactions did not return array');
      }
    } else {
      logTest('Transactions API', 'FAIL', `Transactions failed: ${response.error?.message || 'Unknown error'}`);
    }
    return true;
  } catch (error) {
    logTest('Transactions API', 'FAIL', `Transactions error: ${error.message}`);
    return false;
  }
};

// Test 6: Accounting API
const testAccountingAPI = async () => {
  try {
    const response = await makeRequest('GET', '/accounting');
    if (response.success && response.data.success) {
      logTest('Accounting API', 'PASS', 'Accounting endpoint working');
    } else {
      logTest('Accounting API', 'FAIL', `Accounting failed: ${response.error?.message || 'Unknown error'}`);
    }
    return true;
  } catch (error) {
    logTest('Accounting API', 'FAIL', `Accounting error: ${error.message}`);
    return false;
  }
};

// Test 7: Database Connection
const testDatabaseConnection = async () => {
  try {
    // Test if we can get any data from the database
    const response = await makeRequest('GET', '/dashboard/stats');
    if (response.success && response.data.success) {
      logTest('Database Connection', 'PASS', 'Database queries working');
      return true;
    } else {
      logTest('Database Connection', 'FAIL', 'Database queries failed');
      return false;
    }
  } catch (error) {
    logTest('Database Connection', 'FAIL', `Database error: ${error.message}`);
    return false;
  }
};

// Test 8: CORS and Socket.IO
const testCORSAndSockets = async () => {
  try {
    // Test CORS by making a request from a different origin
    const corsResponse = await axios.get(`${API_BASE}/health`, {
      headers: {
        'Origin': 'http://localhost:5175',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (corsResponse.status === 200) {
      logTest('CORS Configuration', 'PASS', 'CORS working for different origins');
    } else {
      logTest('CORS Configuration', 'FAIL', 'CORS not working properly');
    }

    // Test Socket.IO endpoint
    try {
      const socketResponse = await axios.get(`${SERVER_URL}/socket.io/`, { timeout: 5000 });
      if (socketResponse.status === 200) {
        logTest('Socket.IO Endpoint', 'PASS', 'Socket.IO endpoint accessible');
      } else {
        logTest('Socket.IO Endpoint', 'FAIL', 'Socket.IO endpoint not accessible');
      }
    } catch (socketError) {
      logTest('Socket.IO Endpoint', 'FAIL', `Socket.IO error: ${socketError.message}`);
    }

    return true;
  } catch (error) {
    logTest('CORS and Sockets', 'FAIL', `CORS/Socket test error: ${error.message}`);
    return false;
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting ERP System Fixes Test Suite...\n');
  
  try {
    // Run tests in sequence
    await testServerHealth();
    await testAuthentication();
    await testDatabaseConnection();
    await testCashboxAPI();
    await testOrderHistoryAPI();
    await testTransactionsAPI();
    await testAccountingAPI();
    await testCORSAndSockets();

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    const total = testResults.length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! ERP system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }

    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2));
    console.log('\n📝 Detailed results saved to test-results.json');

  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testResults,
  logTest
};
