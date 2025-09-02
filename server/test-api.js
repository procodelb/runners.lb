const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getApiBase() {
  try {
    const portFile = process.env.SOUFIAN_PORT_FILE || path.join(__dirname, '.server-port');
    if (fs.existsSync(portFile)) {
      const port = fs.readFileSync(portFile, 'utf8').trim();
      if (port) return `http://localhost:${port}/api`;
    }
  } catch {}
  const port = process.env.API_PORT || process.env.PORT || 5000;
  return `http://localhost:${port}/api`;
}

const API_BASE = getApiBase();

async function waitForHealth(maxRetries = 20, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await axios.get(`${API_BASE}/health`, { timeout: 2000 });
      if (res.status === 200) {
        console.log('✅ Health check successful:', res.data);
        return true;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
    console.log(`⏳ Waiting for server health... (${i + 1}/${maxRetries})`);
  }
  throw new Error('Server health check timed out');
}

async function testAPI() {
  try {
    console.log('🧪 Testing API Endpoints...\n');

    // Test 1: Health check (with retry)
    console.log('1️⃣ Testing health check...');
    await waitForHealth();

    // Test 2: Login
    console.log('\n2️⃣ Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    console.log('✅ Login successful');
    
    const token = loginResponse.data.data.token;
    console.log('🔑 Token received:', token.substring(0, 50) + '...');

    // Test 3: Get current user
    console.log('\n3️⃣ Testing /auth/me...');
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ /auth/me successful:', meResponse.data);

    // Test 4: Test transactions endpoint
    console.log('\n4️⃣ Testing transactions endpoint...');
    const transactionsResponse = await axios.get(`${API_BASE}/transactions?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Transactions endpoint successful');
    console.log('📊 Transactions count:', transactionsResponse.data.data.length);

    // Test 5: Test dashboard stats
    console.log('\n5️⃣ Testing dashboard stats...');
    const dashboardResponse = await axios.get(`${API_BASE}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Dashboard stats successful:', dashboardResponse.data);

    console.log('\n🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPI();
