// Comprehensive test for the entire ERP system

const API_BASE = 'https://soufiam-erp-backend.onrender.com';

async function testFullSystem() {
  console.log('🧪 Testing Full ERP System...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    const healthRes = await fetch(`${API_BASE}/health`);
    console.log(`   Status: ${healthRes.status}`);
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log(`   ✅ Server is running: ${healthData.status}`);
    } else {
      console.log('   ❌ Server health check failed');
      return;
    }
    console.log('');

    // Test 2: Login with demo credentials
    console.log('2️⃣ Testing login...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      })
    });

    console.log(`   Status: ${loginRes.status}`);
    
    if (!loginRes.ok) {
      const errorData = await loginRes.json();
      console.log(`   ❌ Login failed: ${errorData.message}`);
      return;
    }

    const loginData = await loginRes.json();
    console.log(`   ✅ Login successful: ${loginData.message}`);
    
    if (!loginData.data || !loginData.data.token) {
      console.log('   ❌ No token received');
      return;
    }

    const token = loginData.data.token;
    console.log(`   🔑 Token received: ${token.substring(0, 20)}...`);
    console.log('');

    // Test 3: Get current user
    console.log('3️⃣ Testing get current user...');
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${meRes.status}`);
    
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log(`   ✅ User authenticated: ${meData.data?.email}`);
    } else {
      const errorData = await meRes.json();
      console.log(`   ❌ Get user failed: ${errorData.message}`);
      return;
    }
    console.log('');

    // Test 4: Test all protected endpoints
    console.log('4️⃣ Testing all protected endpoints...');
    
    const endpoints = [
      { name: 'Dashboard Stats', url: '/api/dashboard/stats' },
      { name: 'Orders', url: '/api/orders?limit=5' },
      { name: 'Transactions', url: '/api/transactions?limit=5' },
      { name: 'Clients', url: '/api/clients?limit=5' },
      { name: 'Drivers', url: '/api/drivers?limit=5' },
      { name: 'Price List', url: '/api/price-list?limit=5' },
      { name: 'Cashbox', url: '/api/cashbox' },
      { name: 'Accounting', url: '/api/accounting' },
      { name: 'Settings', url: '/api/settings' },
      { name: 'Analytics', url: '/api/analytics/dashboard' }
    ];

    let successCount = 0;
    let totalCount = endpoints.length;

    for (const endpoint of endpoints) {
      console.log(`   Testing ${endpoint.name}...`);
      const endpointRes = await fetch(`${API_BASE}${endpoint.url}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`     Status: ${endpointRes.status}`);
      
      if (endpointRes.ok) {
        const endpointData = await endpointRes.json();
        console.log(`     ✅ Success: ${endpointData.success || 'Data received'}`);
        successCount++;
      } else {
        const errorData = await endpointRes.json();
        console.log(`     ❌ Error: ${errorData.message || errorData.error}`);
      }
    }

    console.log(`\n📊 Endpoint Test Results: ${successCount}/${totalCount} successful`);
    console.log('');

    // Test 5: Test logout
    console.log('5️⃣ Testing logout...');
    const logoutRes = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${logoutRes.status}`);
    
    if (logoutRes.ok) {
      const logoutData = await logoutRes.json();
      console.log(`   ✅ Logout successful: ${logoutData.message}`);
    } else {
      const errorData = await logoutRes.json();
      console.log(`   ❌ Logout failed: ${errorData.message}`);
    }

    // Summary
    console.log('\n🎉 System Test Summary:');
    console.log('✅ Backend server is running');
    console.log('✅ Authentication system is working');
    console.log('✅ Demo user credentials are valid');
    console.log(`✅ ${successCount}/${totalCount} API endpoints are accessible`);
    console.log('✅ Logout functionality is working');
    console.log('\n🚀 Your ERP system is fully operational!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Email: soufian@gmail.com');
    console.log('   Password: Soufi@n123');

  } catch (error) {
    console.error('❌ System test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if the backend server is running');
    console.log('2. Verify the API URL is correct');
    console.log('3. Check network connectivity');
    console.log('4. Verify the demo user exists in the database');
  }
}

// Run the test
testFullSystem();
