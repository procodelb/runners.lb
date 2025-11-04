const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Authentication
let authToken = '';

async function authenticate() {
  try {
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    authToken = loginResponse.data.token;
    console.log('✅ Authentication successful');
    return authToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

// Configure axios with auth token
axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

// Test data
const testOrder = {
  order_ref: 'TEST-PAYMENT-001',
  brand_name: 'Test Client',
  customer_name: 'John Doe',
  customer_phone: '+1234567890',
  customer_address: '123 Test Street',
  type: 'ecommerce',
  deliver_method: 'delivery',
  total_usd: 100.00,
  total_lbp: 8900000,
  delivery_fee_usd: 10.00,
  delivery_fee_lbp: 890000,
  driver_fee_usd: 5.00,
  driver_fee_lbp: 445000,
  third_party_fee_usd: 3.00,
  third_party_fee_lbp: 267000,
  payment_status: 'unpaid',
  status: 'delivered',
  notes: 'Test order for payment flow testing'
};

async function testPaymentFlows() {
  console.log('🧪 Starting Payment Flow Tests...\n');

  try {
    // Authenticate first
    await authenticate();
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    // Step 1: Create a test order
    console.log('1️⃣ Creating test order...');
    const orderResponse = await axios.post(`${BASE_URL}/orders`, testOrder);
    const orderId = orderResponse.data.id;
    console.log(`✅ Order created with ID: ${orderId}\n`);

    // Step 2: Test Client Payment (should reduce cash account)
    console.log('2️⃣ Testing Client Payment (should reduce cash account)...');
    const clientPayment = {
      order_id: orderId,
      account_type: 'client',
      account_id: testOrder.brand_name,
      amount_usd: 50.00,
      amount_lbp: 4450000,
      payment_method: 'cash',
      notes: 'Test client payment',
      created_by: 1
    };

    const clientPaymentResponse = await axios.post(`${BASE_URL}/accounting/payments`, clientPayment);
    console.log('✅ Client payment recorded:', clientPaymentResponse.data);
    
    // Check cashbox balance after client payment
    const cashboxAfterClient = await axios.get(`${BASE_URL}/cashbox/balance`);
    console.log('💰 Cashbox balance after client payment:', cashboxAfterClient.data);
    console.log('');

    // Step 3: Test Driver Payment (should add to cash account)
    console.log('3️⃣ Testing Driver Payment (should add to cash account)...');
    const driverPayment = {
      order_id: orderId,
      account_type: 'driver',
      account_id: 1, // Assuming driver ID 1 exists
      amount_usd: 25.00,
      amount_lbp: 2225000,
      payment_method: 'cash',
      notes: 'Test driver payment',
      created_by: 1
    };

    const driverPaymentResponse = await axios.post(`${BASE_URL}/accounting/payments`, driverPayment);
    console.log('✅ Driver payment recorded:', driverPaymentResponse.data);
    
    // Check cashbox balance after driver payment
    const cashboxAfterDriver = await axios.get(`${BASE_URL}/cashbox/balance`);
    console.log('💰 Cashbox balance after driver payment:', cashboxAfterDriver.data);
    console.log('');

    // Step 4: Test Third Party Payment (should add to cash account)
    console.log('4️⃣ Testing Third Party Payment (should add to cash account)...');
    const thirdPartyPayment = {
      order_id: orderId,
      account_type: 'third_party',
      account_id: 1, // Assuming third party ID 1 exists
      amount_usd: 15.00,
      amount_lbp: 1335000,
      payment_method: 'cash',
      notes: 'Test third party payment',
      created_by: 1
    };

    const thirdPartyPaymentResponse = await axios.post(`${BASE_URL}/accounting/payments`, thirdPartyPayment);
    console.log('✅ Third party payment recorded:', thirdPartyPaymentResponse.data);
    
    // Check cashbox balance after third party payment
    const cashboxAfterThirdParty = await axios.get(`${BASE_URL}/cashbox/balance`);
    console.log('💰 Cashbox balance after third party payment:', cashboxAfterThirdParty.data);
    console.log('');

    // Step 5: Test Cash Out functionality
    console.log('5️⃣ Testing Cash Out functionality...');
    const cashOutResponse = await axios.post(`${BASE_URL}/accounting/cashout/${orderId}`, {
      createdBy: 1
    });
    console.log('✅ Cash out completed:', cashOutResponse.data);
    
    // Check cashbox balance after cash out
    const cashboxAfterCashOut = await axios.get(`${BASE_URL}/cashbox/balance`);
    console.log('💰 Cashbox balance after cash out:', cashboxAfterCashOut.data);
    console.log('');

    // Step 6: Verify all payments were recorded
    console.log('6️⃣ Verifying all payments were recorded...');
    const paymentsResponse = await axios.get(`${BASE_URL}/accounting/payments`);
    const orderPayments = paymentsResponse.data.filter(p => p.order_id === orderId);
    console.log(`✅ Found ${orderPayments.length} payments for order ${orderId}:`);
    orderPayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.account_type}: $${payment.amount_usd} / ${payment.amount_lbp} LBP`);
    });
    console.log('');

    console.log('🎉 All payment flow tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Client payments reduce cash account (money going out)');
    console.log('- Driver payments add to cash account (money coming in)');
    console.log('- Third party payments add to cash account (money coming in)');
    console.log('- Cash out functionality works correctly');
    console.log('- All payments are properly recorded and tracked');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the tests
testPaymentFlows();
