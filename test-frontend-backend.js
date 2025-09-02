// Comprehensive test to check frontend-backend connection
const https = require('https');

const FRONTEND_URL = 'https://runners-lb.vercel.app';
const BACKEND_URL = 'https://soufiam-erp-backend.onrender.com';

console.log('🔥 PRO MODE: Testing Frontend-Backend Connection...\n');

// Test 1: Check if frontend can reach backend
async function testFrontendToBackend() {
  console.log('1️⃣ Testing Frontend to Backend Connection...');
  
  try {
    // Simulate what the frontend does
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL, // Simulate frontend origin
      },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      })
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('🌐 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Frontend-Backend Connection: SUCCESS');
      console.log('📦 Login Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Frontend-Backend Connection: FAILED');
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend-Backend Connection Error:', error.message);
    return false;
  }
}

// Test 2: Check CORS headers specifically
async function testCORSHeaders() {
  console.log('\n2️⃣ Testing CORS Headers...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL,
      }
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers')
    };
    
    console.log('🌐 CORS Headers:', corsHeaders);
    
    if (corsHeaders['access-control-allow-origin'] === FRONTEND_URL) {
      console.log('✅ CORS Configuration: CORRECT');
      return true;
    } else {
      console.log('❌ CORS Configuration: INCORRECT');
      console.log('Expected:', FRONTEND_URL);
      console.log('Got:', corsHeaders['access-control-allow-origin']);
      return false;
    }
  } catch (error) {
    console.log('❌ CORS Test Error:', error.message);
    return false;
  }
}

// Test 3: Check if frontend is configured correctly
async function testFrontendConfiguration() {
  console.log('\n3️⃣ Testing Frontend Configuration...');
  
  try {
    const response = await fetch(FRONTEND_URL);
    const html = await response.text();
    
    // Check if the HTML contains the correct API URL
    if (html.includes('VITE_API_URL') || html.includes(BACKEND_URL)) {
      console.log('✅ Frontend Configuration: API URL found in HTML');
      return true;
    } else {
      console.log('❌ Frontend Configuration: API URL not found in HTML');
      console.log('🔍 HTML Preview:', html.substring(0, 500) + '...');
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend Configuration Error:', error.message);
    return false;
  }
}

// Test 4: Check all API endpoints
async function testAllAPIEndpoints() {
  console.log('\n4️⃣ Testing All API Endpoints...');
  
  const endpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/me'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: endpoint === '/api/auth/login' ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL,
        },
        body: endpoint === '/api/auth/login' ? JSON.stringify({
          email: 'soufian@gmail.com',
          password: 'Soufi@n123'
        }) : undefined
      });
      
      results[endpoint] = {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      };
      
      console.log(`📊 ${endpoint}: ${response.status} ${response.ok ? '✅' : '❌'}`);
    } catch (error) {
      results[endpoint] = { error: error.message };
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
  
  return results;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Tests...\n');
  
  const results = {
    frontendBackend: await testFrontendToBackend(),
    cors: await testCORSHeaders(),
    frontendConfig: await testFrontendConfiguration(),
    apiEndpoints: await testAllAPIEndpoints()
  };
  
  console.log('\n📋 COMPREHENSIVE TEST RESULTS:');
  console.log('==============================');
  console.log('✅ Frontend-Backend Connection:', results.frontendBackend ? 'PASSED' : 'FAILED');
  console.log('✅ CORS Configuration:', results.cors ? 'PASSED' : 'FAILED');
  console.log('✅ Frontend Configuration:', results.frontendConfig ? 'PASSED' : 'FAILED');
  
  console.log('\n🔧 TROUBLESHOOTING RECOMMENDATIONS:');
  if (!results.frontendBackend) {
    console.log('❌ Frontend-Backend Connection Failed:');
    console.log('   - Check VITE_API_URL in Vercel environment variables');
    console.log('   - Verify backend URL is correct');
  }
  if (!results.cors) {
    console.log('❌ CORS Configuration Failed:');
    console.log('   - Check FRONTEND_URL in Render environment variables');
    console.log('   - Verify CORS middleware configuration');
  }
  if (!results.frontendConfig) {
    console.log('❌ Frontend Configuration Failed:');
    console.log('   - Check Vercel build configuration');
    console.log('   - Verify environment variables are set');
  }
  
  const allPassed = results.frontendBackend && results.cors && results.frontendConfig;
  console.log(`\n🎯 OVERALL STATUS: ${allPassed ? 'ALL SYSTEMS GO! 🚀' : 'ISSUES DETECTED! 🔧'}`);
  
  return results;
}

runAllTests().catch(console.error);
