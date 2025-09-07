// Test script to verify authentication flow

const API_BASE = 'https://soufiam-erp-backend.onrender.com';

async function testAuthFlow() {
  console.log('🔧 Testing Authentication Flow...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    const healthRes = await fetch(`${API_BASE}/health`);
    console.log(`   Status: ${healthRes.status}`);
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log(`   Response:`, healthData);
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
    
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      console.log(`   Success: ${loginData.success}`);
      console.log(`   Message: ${loginData.message}`);
      
      if (loginData.data && loginData.data.token) {
        const token = loginData.data.token;
        console.log(`   Token: ${token.substring(0, 20)}...`);
        
        // Test 3: Get current user with token
        console.log('\n3️⃣ Testing get current user...');
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`   Status: ${meRes.status}`);
        
        if (meRes.ok) {
          const meData = await meRes.json();
          console.log(`   Success: ${meData.success}`);
          console.log(`   User: ${meData.data?.email}`);
        } else {
          const errorData = await meRes.json();
          console.log(`   Error: ${errorData.message}`);
        }

        // Test 4: Test protected endpoints
        console.log('\n4️⃣ Testing protected endpoints...');
        
        const endpoints = [
          '/api/dashboard/stats',
          '/api/orders?limit=5',
          '/api/transactions?limit=5'
        ];

        for (const endpoint of endpoints) {
          console.log(`   Testing ${endpoint}...`);
          const endpointRes = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          console.log(`     Status: ${endpointRes.status}`);
          
          if (endpointRes.ok) {
            const endpointData = await endpointRes.json();
            console.log(`     Success: ${endpointData.success || 'Data received'}`);
          } else {
            const errorData = await endpointRes.json();
            console.log(`     Error: ${errorData.message || errorData.error}`);
          }
        }

      } else {
        console.log('   ❌ No token received');
      }
    } else {
      const errorData = await loginRes.json();
      console.log(`   Error: ${errorData.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAuthFlow();
