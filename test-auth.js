// Test script to verify authentication
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // Test 1: Login with demo credentials
    console.log('1️⃣ Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'runners.leb@gmail.com',
      password: '123456789'
    });

    const loginData = loginResponse.data;
    console.log('Login Response Status:', loginResponse.status);
    console.log('Login Response:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      console.log('❌ Login failed');
      return;
    }

    const token = loginData.data.token;
    console.log('✅ Login successful, token received\n');

    // Test 2: Get current user with token
    console.log('2️⃣ Testing /me endpoint...');
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const meData = meResponse.data;
    console.log('Me Response Status:', meResponse.status);
    console.log('Me Response:', JSON.stringify(meData, null, 2));

    if (meData.success) {
      console.log('✅ /me endpoint working correctly');
    } else {
      console.log('❌ /me endpoint failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAuth();
