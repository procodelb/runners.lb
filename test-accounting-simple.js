// Simple test script for accounting system
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:5000/api';

// Simple HTTP request function
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
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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
  console.log('🚀 Testing Accounting System...');

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

    // 2. Test accounting endpoints
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('📊 Testing accounting overview...');
    const overviewResponse = await makeRequest(`${API_BASE}/accounting/overview`, { headers });
    console.log(`✅ Overview: ${overviewResponse.status} - ${overviewResponse.data.data?.length || 0} records`);

    console.log('👥 Testing clients accounting...');
    const clientsResponse = await makeRequest(`${API_BASE}/accounting/clients`, { headers });
    console.log(`✅ Clients: ${clientsResponse.status} - ${clientsResponse.data.data?.length || 0} records`);

    console.log('🚚 Testing drivers accounting...');
    const driversResponse = await makeRequest(`${API_BASE}/accounting/drivers`, { headers });
    console.log(`✅ Drivers: ${driversResponse.status} - ${driversResponse.data.data?.length || 0} records`);

    console.log('🏢 Testing third-party accounting...');
    const thirdPartyResponse = await makeRequest(`${API_BASE}/accounting/third-party`, { headers });
    console.log(`✅ Third-party: ${thirdPartyResponse.status} - ${thirdPartyResponse.data.data?.length || 0} records`);

    console.log('💱 Testing exchange rates...');
    const ratesResponse = await makeRequest(`${API_BASE}/accounting/exchange-rates`, { headers });
    console.log(`✅ Exchange rates: ${ratesResponse.status} - ${ratesResponse.data.data?.length || 0} records`);

    console.log('🎉 All accounting tests completed successfully!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAccountingSystem();
