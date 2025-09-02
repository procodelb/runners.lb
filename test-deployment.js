// Test script to verify deployment configuration
const https = require('https');

const FRONTEND_URL = 'https://runners-lb.vercel.app';
const BACKEND_URL = 'https://soufiam-erp-backend.onrender.com';

console.log('🧪 Testing Deployment Configuration...\n');

// Test 1: Backend Health Check
async function testBackendHealth() {
  console.log('1️⃣ Testing Backend Health...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Backend Health:', data);
    return true;
  } catch (error) {
    console.log('❌ Backend Health Failed:', error.message);
    return false;
  }
}

// Test 2: Login Endpoint
async function testLogin() {
  console.log('\n2️⃣ Testing Login Endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      })
    });
    
    const data = await response.json();
    console.log('📊 Login Response Status:', response.status);
    console.log('📦 Login Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('✅ Login Test Passed');
      return true;
    } else {
      console.log('❌ Login Test Failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Login Test Error:', error.message);
    return false;
  }
}

// Test 3: CORS Test
async function testCORS() {
  console.log('\n3️⃣ Testing CORS Configuration...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers')
    };
    
    console.log('🌐 CORS Headers:', corsHeaders);
    
    if (corsHeaders['access-control-allow-origin']) {
      console.log('✅ CORS Configuration Present');
      return true;
    } else {
      console.log('❌ CORS Configuration Missing');
      return false;
    }
  } catch (error) {
    console.log('❌ CORS Test Error:', error.message);
    return false;
  }
}

// Test 4: Frontend Accessibility
async function testFrontend() {
  console.log('\n4️⃣ Testing Frontend Accessibility...');
  try {
    const response = await fetch(FRONTEND_URL);
    console.log('📊 Frontend Response Status:', response.status);
    
    if (response.ok) {
      console.log('✅ Frontend Accessible');
      return true;
    } else {
      console.log('❌ Frontend Not Accessible');
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend Test Error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    backend: await testBackendHealth(),
    login: await testLogin(),
    cors: await testCORS(),
    frontend: await testFrontend()
  };
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 Overall Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    console.log('\n🔧 Troubleshooting Steps:');
    if (!results.backend) {
      console.log('- Check Render deployment and environment variables');
    }
    if (!results.login) {
      console.log('- Verify JWT_SECRET and DATABASE_URL on Render');
    }
    if (!results.cors) {
      console.log('- Check FRONTEND_URL environment variable on Render');
    }
    if (!results.frontend) {
      console.log('- Check Vercel deployment and VITE_API_URL');
    }
  }
}

runTests().catch(console.error);
