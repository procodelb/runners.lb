const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test credentials (you may need to adjust these)
const TEST_USER = {
  email: 'runners.leb@gmail.com',
  password: 'admin123'
};

let authToken = '';

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return authToken;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ API call failed (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

async function testCashboxSystem() {
  try {
    console.log('🚀 Starting Cashbox System Test...\n');
    
    // 1. Login
    await login();
    
    // 2. Get initial cashbox balance
    console.log('📊 Getting initial cashbox balance...');
    const initialBalance = await apiCall('GET', '/cashbox/balance');
    console.log('Initial balance:', initialBalance.data);
    console.log('');
    
    // 3. Set initial capital
    console.log('💰 Setting initial capital...');
    const capitalData = {
      amount_usd: 1000,
      amount_lbp: 1500000,
      description: 'Initial capital setup for testing'
    };
    const capitalResult = await apiCall('POST', '/cashbox/capital', capitalData);
    console.log('Capital set:', capitalResult.data);
    console.log('');
    
    // 4. Add income to cash account
    console.log('📈 Adding income to cash account...');
    const incomeData = {
      amount_usd: 150,
      amount_lbp: 225000,
      description: 'Sales revenue',
      account_type: 'cash',
      notes: 'Test income entry'
    };
    const incomeResult = await apiCall('POST', '/cashbox/income', incomeData);
    console.log('Income added:', incomeResult.data);
    console.log('');
    
    // 5. Add expense from cash account
    console.log('📉 Adding expense from cash account...');
    const expenseData = {
      amount_usd: 50,
      amount_lbp: 75000,
      description: 'Office supplies',
      account_type: 'cash',
      category: 'Office & Admin',
      subcategory: 'Office Supplies',
      notes: 'Test expense entry'
    };
    const expenseResult = await apiCall('POST', '/cashbox/expense', expenseData);
    console.log('Expense added:', expenseResult.data);
    console.log('');
    
    // 6. Transfer between accounts
    console.log('🔄 Transferring between accounts...');
    const transferData = {
      amount_usd: 100,
      amount_lbp: 150000,
      from_account: 'cash',
      to_account: 'wish',
      description: 'Moving funds to wish account'
    };
    const transferResult = await apiCall('POST', '/cashbox/transfer', transferData);
    console.log('Transfer completed:', transferResult.data);
    console.log('');
    
    // 7. Get expense categories
    console.log('📋 Getting expense categories...');
    const categories = await apiCall('GET', '/cashbox/expense-categories');
    console.log('Expense categories:', categories.data.length, 'categories found');
    console.log('');
    
    // 8. Get timeline
    console.log('📜 Getting cashbox timeline...');
    const timeline = await apiCall('GET', '/cashbox/timeline?limit=5');
    console.log('Recent entries:', timeline.data.length, 'entries');
    timeline.data.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.entry_type}: ${entry.amount_usd} USD, ${entry.amount_lbp} LBP - ${entry.description}`);
    });
    console.log('');
    
    // 9. Get final balance
    console.log('📊 Getting final cashbox balance...');
    const finalBalance = await apiCall('GET', '/cashbox/balance');
    console.log('Final balance:', finalBalance.data);
    console.log('');
    
    // 10. Generate report
    console.log('📊 Generating cashbox report...');
    const report = await apiCall('GET', '/cashbox/report');
    console.log('Report summary:', report.data.summary);
    console.log('Report breakdown:', report.data.breakdown.length, 'categories');
    console.log('');
    
    console.log('✅ All cashbox system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testCashboxSystem()
    .then(() => {
      console.log('🎉 Test suite completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testCashboxSystem };
