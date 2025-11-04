// Debug script to check accounting data
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

async function debugAccountingData() {
  console.log('🔍 Debugging Accounting Data...');

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

    // Test overview to see the data
    console.log('📊 Testing overview...');
    const overviewResponse = await makeRequest(`${API_BASE}/accounting/overview`, { headers });
    
    if (overviewResponse.status === 200) {
      const data = overviewResponse.data.data || [];
      console.log(`✅ Overview: ${data.length} records`);
      
      // Check client_id values
      const clientIds = data.map(o => o.client_id).filter(id => id !== null);
      console.log('📋 Client IDs in overview:', [...new Set(clientIds)]);
      
      // Check driver_id values
      const driverIds = data.map(o => o.driver_id).filter(id => id !== null);
      console.log('📋 Driver IDs in overview:', [...new Set(driverIds)]);
      
      // Show sample records
      console.log('📋 Sample records:');
      data.slice(0, 3).forEach((record, i) => {
        console.log(`  ${i+1}. ID: ${record.id}, Client: ${record.client_id}, Driver: ${record.driver_id}, Type: ${record.delivery_method}`);
      });
    } else {
      console.log(`❌ Overview failed: ${overviewResponse.status} - ${overviewResponse.rawData}`);
    }

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugAccountingData();
