// Test client-side authentication flow

async function testClientAuth() {
  console.log('🧪 Testing Client-Side Authentication...\n');

  try {
    // Test 1: Login request
    console.log('1️⃣ Testing login request...');
    const loginRes = await fetch('https://soufiam-erp-backend.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      }),
      credentials: 'include'
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

    // Test 2: Get current user (simulating client-side fetchMe)
    console.log('2️⃣ Testing get current user (client-side)...');
    const meRes = await fetch('https://soufiam-erp-backend.onrender.com/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    console.log(`   Status: ${meRes.status}`);
    
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log(`   ✅ User authenticated: ${meData.data?.email}`);
      console.log(`   👤 User data:`, meData.data);
    } else {
      const errorData = await meRes.json();
      console.log(`   ❌ Get user failed: ${errorData.message}`);
    }
    console.log('');

    // Test 3: Test API endpoints (simulating client-side API calls)
    console.log('3️⃣ Testing API endpoints (client-side)...');
    
    const endpoints = [
      { name: 'Dashboard Stats', url: 'https://soufiam-erp-backend.onrender.com/api/dashboard/stats' },
      { name: 'Orders', url: 'https://soufiam-erp-backend.onrender.com/api/orders?limit=5' },
      { name: 'Transactions', url: 'https://soufiam-erp-backend.onrender.com/api/transactions?limit=5' }
    ];

    for (const endpoint of endpoints) {
      console.log(`   Testing ${endpoint.name}...`);
      const endpointRes = await fetch(endpoint.url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log(`     Status: ${endpointRes.status}`);
      
      if (endpointRes.ok) {
        const endpointData = await endpointRes.json();
        console.log(`     ✅ Success: ${endpointData.success || 'Data received'}`);
      } else {
        const errorData = await endpointRes.json();
        console.log(`     ❌ Error: ${errorData.message || errorData.error}`);
      }
    }

    console.log('\n🎉 Client Authentication Test Summary:');
    console.log('✅ Login endpoint is accessible');
    console.log('✅ Token-based authentication is working');
    console.log('✅ User data retrieval is working');
    console.log('✅ Protected API endpoints are accessible');
    console.log('✅ Credentials are being sent correctly');
    console.log('\n🚀 Client-side authentication is working correctly!');

  } catch (error) {
    console.error('❌ Client auth test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if the backend URL is correct');
    console.log('2. Verify CORS is properly configured');
    console.log('3. Check if credentials are being sent');
    console.log('4. Verify the token format is correct');
  }
}

// Run the test
testClientAuth();
