const { computeDisplayedAmounts } = require('./utils/computeDisplayedAmounts');

function assertEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error('❌', msg, 'Expected:', b, 'Got:', a);
    process.exit(1);
  }
}

// In-house ecommerce
const ih = computeDisplayedAmounts({
  total_usd: 10,
  total_lbp: 1000,
  delivery_fee_usd: 2,
  delivery_fee_lbp: 200,
  third_party_fee_usd: 0,
  third_party_fee_lbp: 0,
  driver_fee_usd: 1,
  driver_fee_lbp: 100,
  deliver_method: 'in_house',
  type: 'ecommerce'
});
assertEqual({u: ih.computedTotalUSD, l: ih.computedTotalLBP, show: ih.showDeliveryFees}, {u: 10, l: 1000, show: true}, 'in_house ecommerce totals');

// In-house instant
const ihInst = computeDisplayedAmounts({
  total_usd: 10,
  total_lbp: 1000,
  delivery_fee_usd: 2,
  delivery_fee_lbp: 200,
  driver_fee_usd: 1,
  driver_fee_lbp: 100,
  deliver_method: 'in_house',
  type: 'instant'
});
assertEqual({u: ihInst.computedTotalUSD, l: ihInst.computedTotalLBP, show: ihInst.showDeliveryFees}, {u: 11, l: 1100, show: false}, 'in_house instant totals');

// Third party ecommerce
const tp = computeDisplayedAmounts({
  total_usd: 10,
  total_lbp: 1000,
  delivery_fee_usd: 2,
  delivery_fee_lbp: 200,
  third_party_fee_usd: 3,
  third_party_fee_lbp: 300,
  deliver_method: 'third_party',
  type: 'ecommerce'
});
assertEqual({u: tp.computedTotalUSD, l: tp.computedTotalLBP, show: tp.showDeliveryFees}, {u: 15, l: 1500, show: true}, 'third_party ecommerce totals');

// Third party instant
const tpInst = computeDisplayedAmounts({
  total_usd: 10,
  total_lbp: 1000,
  driver_fee_usd: 1,
  driver_fee_lbp: 100,
  third_party_fee_usd: 3,
  third_party_fee_lbp: 300,
  deliver_method: 'third_party',
  type: 'instant'
});
assertEqual({u: tpInst.computedTotalUSD, l: tpInst.computedTotalLBP, show: tpInst.showDeliveryFees}, {u: 14, l: 1400, show: false}, 'third_party instant totals');

console.log('✅ computeDisplayedAmounts unit tests passed');

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Simple test to debug issues
async function testSimple() {
  try {
    console.log('🧪 Simple Test to Debug Issues...\n');

    // Login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    
    const authToken = loginResponse.data.data.token;
    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Test basic endpoints
    console.log('1️⃣ Testing basic dashboard...');
    try {
      const response = await api.get('/dashboard/stats');
      console.log('✅ Basic dashboard working');
    } catch (error) {
      console.log('❌ Basic dashboard error:', error.response?.data?.message || error.message);
    }

    // Test analytics dashboard
    console.log('\n2️⃣ Testing analytics dashboard...');
    try {
      const response = await api.get('/analytics/dashboard');
      console.log('✅ Analytics dashboard working');
    } catch (error) {
      console.log('❌ Analytics dashboard error:', error.response?.data?.message || error.message);
    }

    // Test financial summary
    console.log('\n3️⃣ Testing financial summary...');
    try {
      const response = await api.get('/dashboard/financial-summary');
      console.log('✅ Financial summary working');
    } catch (error) {
      console.log('❌ Financial summary error:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Simple test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimple();
