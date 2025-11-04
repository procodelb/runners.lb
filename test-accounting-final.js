// Final comprehensive test for accounting system
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

async function testAccountingSystem() {
  console.log('🚀 Final Accounting System Test...');

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

    const headers = { 'Authorization': `Bearer ${token}` };

    // Test all endpoints
    const endpoints = [
      { name: 'Overview', url: '/accounting/overview' },
      { name: 'Clients', url: '/accounting/clients' },
      { name: 'Drivers', url: '/accounting/drivers' },
      { name: 'Third-party', url: '/accounting/third-party' },
      { name: 'Exchange Rates', url: '/accounting/exchange-rates' }
    ];

    for (const endpoint of endpoints) {
      console.log(`📊 Testing ${endpoint.name}...`);
      const response = await makeRequest(`${API_BASE}${endpoint.url}`, { headers });
      
      if (response.status === 200) {
        const data = response.data.data || [];
        console.log(`✅ ${endpoint.name}: ${data.length} records`);
        
        // Show sample data for first endpoint
        if (endpoint.name === 'Overview' && data.length > 0) {
          console.log('📋 Sample record:', JSON.stringify(data[0], null, 2));
        }
      } else {
        console.log(`❌ ${endpoint.name}: ${response.status} - ${response.rawData}`);
      }
    }

    // Test payment recording
    console.log('💰 Testing payment recording...');
    const paymentData = {
      orderId: 123,
      accountType: 'client',
      accountId: 52,
      amountUsd: 25.00,
      amountLbp: 0,
      method: 'cash',
      note: 'Test payment',
      createdBy: 7
    };

    const paymentResponse = await makeRequest(`${API_BASE}/accounting/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData)
    });

    if (paymentResponse.status === 200) {
      console.log('✅ Payment recorded successfully');
    } else {
      console.log(`❌ Payment recording failed: ${paymentResponse.status} - ${paymentResponse.rawData}`);
    }

    console.log('🎉 Accounting system test completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAccountingSystem();
