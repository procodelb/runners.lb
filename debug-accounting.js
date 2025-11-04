// Debug script for accounting system
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, rawData: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, rawData: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function debugAccounting() {
  console.log('🔍 Debugging Accounting System...');

  try {
    // 1. Login
    console.log('🔐 Authenticating...');
    const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@soufiam.com',
        password: 'admin123'
      })
    });

    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.error('❌ Authentication failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Authentication successful');

    // 2. Test simple endpoint first
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('📊 Testing accounting overview...');
    const overviewResponse = await makeRequest(`${API_BASE}/accounting/overview`, { headers });
    console.log(`Status: ${overviewResponse.status}`);
    console.log(`Raw response:`, overviewResponse.rawData);

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugAccounting();
