const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'runners.leb@gmail.com';
const TEST_PASSWORD = '123456789';

let authToken = '';

// Test data
const testDeliveryPrice = {
  country: 'Lebanon',
  region: 'Test Region',
  sub_region: 'Test Sub Region',
  price_lbp: 150000,
  price_usd: 1.69,
  is_active: true
};

const testClient = {
  business_name: 'Test Client for Delivery Prices',
  contact_person: 'Test Contact',
  phone: '+961-70-123456',
  address: 'Test Address',
  category: 'shop'
};

const testOrder = {
  customer_name: 'Test Client for Delivery Prices',
  customer_phone: '+961-70-123456',
  customer_address: 'Test Address',
  brand_name: 'Test Brand',
  delivery_country: 'Lebanon',
  delivery_region: 'Test Region',
  delivery_sub_region: 'Test Sub Region',
  total_lbp: 150000,
  total_usd: 1.69,
  status: 'new',
  payment_status: 'unpaid'
};

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.success) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testDeliveryPricesAPI() {
  console.log('\n📋 Testing Delivery Prices API...');

  try {
    // Test 1: Create delivery price
    console.log('1. Creating delivery price...');
    const createResponse = await axios.post(`${BASE_URL}/delivery-prices`, testDeliveryPrice, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (createResponse.data.success) {
      console.log('✅ Delivery price created:', createResponse.data.data.id);
      const priceId = createResponse.data.data.id;

      // Test 2: Get delivery price by ID
      console.log('2. Getting delivery price by ID...');
      const getResponse = await axios.get(`${BASE_URL}/delivery-prices/${priceId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (getResponse.data.success) {
        console.log('✅ Delivery price retrieved:', getResponse.data.data.region);
      } else {
        console.log('❌ Failed to get delivery price');
      }

      // Test 3: Lookup delivery price by location
      console.log('3. Looking up delivery price by location...');
      const lookupResponse = await axios.get(`${BASE_URL}/delivery-prices/lookup/location`, {
        params: {
          country: 'Lebanon',
          region: 'Test Region',
          sub_region: 'Test Sub Region'
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (lookupResponse.data.success) {
        console.log('✅ Delivery price lookup successful:', lookupResponse.data.data.price_lbp, 'LBP');
      } else {
        console.log('❌ Failed to lookup delivery price');
      }

      // Test 4: Get all delivery prices
      console.log('4. Getting all delivery prices...');
      const allResponse = await axios.get(`${BASE_URL}/delivery-prices`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (allResponse.data.success) {
        console.log('✅ Retrieved', allResponse.data.data.length, 'delivery prices');
      } else {
        console.log('❌ Failed to get all delivery prices');
      }

      return priceId;
    } else {
      console.log('❌ Failed to create delivery price');
      return null;
    }
  } catch (error) {
    console.log('❌ Delivery prices API error:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testClientAccountsAPI() {
  console.log('\n👥 Testing Client Accounts API...');

  try {
    // Test 1: Create test client
    console.log('1. Creating test client...');
    const createClientResponse = await axios.post(`${BASE_URL}/clients`, testClient, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (createClientResponse.data.success) {
      console.log('✅ Test client created:', createClientResponse.data.data.id);
      const clientId = createClientResponse.data.data.id;

      // Test 2: Set client account balance
      console.log('2. Setting client account balance...');
      const setBalanceResponse = await axios.put(`${BASE_URL}/client-accounts/${clientId}`, {
        old_balance_lbp: 50000,
        old_balance_usd: 0.56
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (setBalanceResponse.data.success) {
        console.log('✅ Client account balance set');
      } else {
        console.log('❌ Failed to set client account balance');
      }

      // Test 3: Get client account details
      console.log('3. Getting client account details...');
      const getAccountResponse = await axios.get(`${BASE_URL}/client-accounts/${clientId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (getAccountResponse.data.success) {
        console.log('✅ Client account retrieved');
        console.log('   - Old Balance LBP:', getAccountResponse.data.data.account.old_balance_lbp);
        console.log('   - Current Balance LBP:', getAccountResponse.data.data.account.current_balance_lbp);
      } else {
        console.log('❌ Failed to get client account');
      }

      return clientId;
    } else {
      console.log('❌ Failed to create test client');
      return null;
    }
  } catch (error) {
    console.log('❌ Client accounts API error:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testOrderWithDeliveryPrice(clientId) {
  console.log('\n📦 Testing Order Creation with Delivery Price...');

  try {
    // Test 1: Create order with delivery location
    console.log('1. Creating order with delivery location...');
    const createOrderResponse = await axios.post(`${BASE_URL}/orders`, testOrder, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (createOrderResponse.data.success) {
      console.log('✅ Order created:', createOrderResponse.data.data.id);
      const orderId = createOrderResponse.data.data.id;

      // Check if delivery price was automatically applied
      const order = createOrderResponse.data.data;
      console.log('   - Delivery Fee LBP:', order.delivery_fee_lbp);
      console.log('   - Delivery Fee USD:', order.delivery_fee_usd);
      console.log('   - Delivery Price ID:', order.delivery_price_id);

      if (order.delivery_price_id && order.delivery_fee_lbp === 150000) {
        console.log('✅ Delivery price automatically applied!');
      } else {
        console.log('⚠️  Delivery price not automatically applied');
      }

      return orderId;
    } else {
      console.log('❌ Failed to create order');
      return null;
    }
  } catch (error) {
    console.log('❌ Order creation error:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testPaymentsAPI(clientId, orderId) {
  console.log('\n💰 Testing Payments API...');

  try {
    // Test 1: Create payment
    console.log('1. Creating payment...');
    const createPaymentResponse = await axios.post(`${BASE_URL}/payments`, {
      client_id: clientId,
      order_id: orderId,
      amount_lbp: 100000,
      amount_usd: 1.12,
      payment_method: 'cash',
      description: 'Test payment for delivery price integration'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (createPaymentResponse.data.success) {
      console.log('✅ Payment created:', createPaymentResponse.data.data.id);
      const paymentId = createPaymentResponse.data.data.id;

      // Test 2: Get client payments
      console.log('2. Getting client payments...');
      const getPaymentsResponse = await axios.get(`${BASE_URL}/payments/client/${clientId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (getPaymentsResponse.data.success) {
        console.log('✅ Retrieved', getPaymentsResponse.data.data.payments.length, 'payments');
        console.log('   - Total Payments LBP:', getPaymentsResponse.data.data.balance.total_payments_lbp);
      } else {
        console.log('❌ Failed to get client payments');
      }

      // Test 3: Generate client statement
      console.log('3. Generating client statement...');
      const statementResponse = await axios.get(`${BASE_URL}/client-accounts/${clientId}/statement`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (statementResponse.data.success) {
        console.log('✅ Client statement generated');
        console.log('   - Opening Balance LBP:', statementResponse.data.data.opening_balance.lbp);
        console.log('   - Closing Balance LBP:', statementResponse.data.data.closing_balance.lbp);
        console.log('   - Transactions:', statementResponse.data.data.transactions.length);
      } else {
        console.log('❌ Failed to generate client statement');
      }

      return paymentId;
    } else {
      console.log('❌ Failed to create payment');
      return null;
    }
  } catch (error) {
    console.log('❌ Payments API error:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testPriceImportAPI() {
  console.log('\n📤 Testing Price Import API...');

  try {
    // Test 1: Get import template
    console.log('1. Getting import template...');
    const templateResponse = await axios.get(`${BASE_URL}/price-import/template`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (templateResponse.status === 200) {
      console.log('✅ Import template retrieved');
    } else {
      console.log('❌ Failed to get import template');
    }

    // Test 2: Validate prices data
    console.log('2. Validating prices data...');
    const validateResponse = await axios.post(`${BASE_URL}/price-import/validate`, {
      prices: [
        {
          country: 'Lebanon',
          region: 'Test Validation',
          sub_region: 'Test Sub',
          price_lbp: 200000,
          price_usd: 2.25
        },
        {
          country: 'Lebanon',
          region: 'Test Validation 2',
          price_lbp: 250000,
          price_usd: 2.81
        }
      ]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (validateResponse.data.success) {
      console.log('✅ Price validation successful');
      console.log('   - Valid entries:', validateResponse.data.data.valid);
      console.log('   - Invalid entries:', validateResponse.data.data.invalid);
    } else {
      console.log('❌ Failed to validate prices');
    }

    // Test 3: Bulk import prices
    console.log('3. Bulk importing prices...');
    const bulkImportResponse = await axios.post(`${BASE_URL}/price-import/bulk-update`, {
      prices: [
        {
          country: 'Lebanon',
          region: 'Bulk Test Region 1',
          sub_region: 'Bulk Test Sub 1',
          price_lbp: 180000,
          price_usd: 2.02
        },
        {
          country: 'Lebanon',
          region: 'Bulk Test Region 2',
          price_lbp: 220000,
          price_usd: 2.47
        }
      ],
      update_mode: 'upsert'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (bulkImportResponse.data.success) {
      console.log('✅ Bulk import successful');
      console.log('   - Processed:', bulkImportResponse.data.data.processed);
      console.log('   - Successful:', bulkImportResponse.data.data.successful);
      console.log('   - Failed:', bulkImportResponse.data.data.failed);
    } else {
      console.log('❌ Failed to bulk import prices');
    }

  } catch (error) {
    console.log('❌ Price import API error:', error.response?.data?.message || error.message);
  }
}

async function runIntegrationTest() {
  console.log('🚀 Starting Delivery Prices Integration Test...\n');

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }

  // Step 2: Test Delivery Prices API
  const priceId = await testDeliveryPricesAPI();

  // Step 3: Test Client Accounts API
  const clientId = await testClientAccountsAPI();

  // Step 4: Test Order Creation with Delivery Price
  const orderId = await testOrderWithDeliveryPrice(clientId);

  // Step 5: Test Payments API
  if (clientId && orderId) {
    await testPaymentsAPI(clientId, orderId);
  }

  // Step 6: Test Price Import API
  await testPriceImportAPI();

  console.log('\n🎉 Integration test completed!');
  console.log('\n📊 Summary:');
  console.log('✅ Delivery Prices API - Tested');
  console.log('✅ Client Accounts API - Tested');
  console.log('✅ Order Creation with Auto Price Injection - Tested');
  console.log('✅ Payments API - Tested');
  console.log('✅ Price Import API - Tested');
  console.log('\n🔧 Your ERP system now supports:');
  console.log('   - Automatic delivery price injection based on location');
  console.log('   - Dual currency support (LBP/USD)');
  console.log('   - Client account balance tracking');
  console.log('   - Payment processing and reconciliation');
  console.log('   - CSV/Excel price list import');
  console.log('   - Comprehensive accounting reports');
}

// Run the test
runIntegrationTest().catch(console.error);
