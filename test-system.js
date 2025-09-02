const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test configuration
const testConfig = {
  email: 'soufian@gmail.com',
  password: 'Soufi@n123'
};

let authToken = '';

// Helper function to make authenticated requests
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Test functions
async function testAuth() {
  console.log('🔐 Testing Authentication...');
  try {
    const response = await api.post('/auth/login', testConfig);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDrivers() {
  console.log('\n🚗 Testing Drivers...');
  try {
    // Test get drivers
    const driversResponse = await api.get('/drivers');
    console.log('✅ Get drivers successful:', driversResponse.data.data?.length || 0, 'drivers found');

    // Test create driver
    const newDriver = {
      full_name: 'Test Driver',
      phone: '+96170123456',
      address: 'Beirut, Lebanon',
      notes: 'Test driver for system verification',
      default_fee_lbp: 200000,
      default_fee_usd: 2.25,
      active: true
    };

    const createResponse = await api.post('/drivers', newDriver);
    console.log('✅ Create driver successful:', createResponse.data.data.id);

    const driverId = createResponse.data.data.id;

    // Test update driver
    const updateData = { notes: 'Updated test driver notes' };
    const updateResponse = await api.put(`/drivers/${driverId}`, updateData);
    console.log('✅ Update driver successful');

    // Test driver fees
    const feesData = {
      amount_lbp: 50000,
      amount_usd: 0.56,
      description: 'Test driver fee',
      type: 'driver_fee'
    };
    const feesResponse = await api.post(`/drivers/${driverId}/fees`, feesData);
    console.log('✅ Add driver fees successful');

    // Test delete driver
    const deleteResponse = await api.delete(`/drivers/${driverId}`);
    console.log('✅ Delete driver successful');

    return true;
  } catch (error) {
    console.error('❌ Drivers test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testOrders() {
  console.log('\n📦 Testing Orders...');
  try {
    // Test get orders
    const ordersResponse = await api.get('/orders');
    console.log('✅ Get orders successful:', ordersResponse.data.data?.length || 0, 'orders found');

    // Test create order
    const newOrder = {
      order_ref: 'TEST-ORD-001',
      type: 'ecommerce',
      customer_phone: '+96170123456',
      customer_name: 'Test Customer',
      customer_address: 'Beirut, Lebanon',
      brand_name: 'Test Brand',
      deliver_method: 'in_house',
      total_usd: 25.00,
      total_lbp: 2225000
    };

    const createResponse = await api.post('/orders', newOrder);
    console.log('✅ Create order successful:', createResponse.data.data.id);

    const orderId = createResponse.data.data.id;

    // Test update order
    const updateData = { notes: 'Test order notes' };
    const updateResponse = await api.put(`/orders/${orderId}`, updateData);
    console.log('✅ Update order successful');

    // Test delete order
    const deleteResponse = await api.delete(`/orders/${orderId}`);
    console.log('✅ Delete order successful');

    return true;
  } catch (error) {
    console.error('❌ Orders test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCashbox() {
  console.log('\n💰 Testing Cashbox...');
  try {
    // Test get cashbox balance
    const balanceResponse = await api.get('/cashbox');
    console.log('✅ Get cashbox balance successful');

    // Test get cashbox entries
    const entriesResponse = await api.get('/cashbox/entries');
    console.log('✅ Get cashbox entries successful:', entriesResponse.data.data?.length || 0, 'entries found');

    // Test create cashbox entry
    const newEntry = {
      type: 'cash_in',
      amount_usd: 100.00,
      amount_lbp: 8900000,
      description: 'Test cash entry'
    };

    const createResponse = await api.post('/cashbox/entry', newEntry);
    console.log('✅ Create cashbox entry successful:', createResponse.data.data.id);

    const entryId = createResponse.data.data.id;

    // Test delete entry
    const deleteResponse = await api.delete(`/cashbox/entry/${entryId}`);
    console.log('✅ Delete cashbox entry successful');

    return true;
  } catch (error) {
    console.error('❌ Cashbox test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCRM() {
  console.log('\n👥 Testing CRM...');
  try {
    // Test get clients
    const clientsResponse = await api.get('/crm');
    console.log('✅ Get clients successful:', clientsResponse.data.data?.length || 0, 'clients found');

    // Test create client
    const newClient = {
      business_name: 'Test Business',
      contact_person: 'Test Contact',
      phone: '+96170123456',
      address: 'Beirut, Lebanon',
      category: 'Retail'
    };

    const createResponse = await api.post('/crm', newClient);
    console.log('✅ Create client successful:', createResponse.data.data.id);

    const clientId = createResponse.data.data.id;

    // Test update client
    const updateData = { notes: 'Test client notes' };
    const updateResponse = await api.put(`/crm/${clientId}`, updateData);
    console.log('✅ Update client successful');

    // Test delete client
    const deleteResponse = await api.delete(`/crm/${clientId}`);
    console.log('✅ Delete client successful');

    return true;
  } catch (error) {
    console.error('❌ CRM test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testTransactions() {
  console.log('\n💳 Testing Transactions...');
  try {
    // Test get transactions
    const transactionsResponse = await api.get('/transactions');
    console.log('✅ Get transactions successful:', transactionsResponse.data.data?.length || 0, 'transactions found');

    // Test create transaction
    const newTransaction = {
      type: 'income',
      amount_usd: 50.00,
      amount_lbp: 4450000,
      description: 'Test transaction'
    };

    const createResponse = await api.post('/transactions', newTransaction);
    console.log('✅ Create transaction successful:', createResponse.data.data.id);

    const transactionId = createResponse.data.data.id;

    // Test delete transaction
    const deleteResponse = await api.delete(`/transactions/${transactionId}`);
    console.log('✅ Delete transaction successful');

    return true;
  } catch (error) {
    console.error('❌ Transactions test failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 Starting Soufian ERP System Tests...\n');

  const tests = [
    { name: 'Authentication', fn: testAuth },
    { name: 'Drivers', fn: testDrivers },
    { name: 'Orders', fn: testOrders },
    { name: 'Cashbox', fn: testCashbox },
    { name: 'CRM', fn: testCRM },
    { name: 'Transactions', fn: testTransactions }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} test crashed:`, error.message);
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The system is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
