// Use built-in fetch in Node.js 18+
const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

// Test authentication
async function authenticate() {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@soufiam.com',
        password: 'admin123'
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    } else {
      console.error('❌ Authentication failed:', await response.text());
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return null;
  }
}

// Test accounting endpoints
async function testAccountingEndpoints(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('🧪 Testing Accounting Endpoints...');

  try {
    // Test 1: Get accounting overview
    console.log('📊 Testing accounting overview...');
    const overviewResponse = await fetch(`${API_BASE}/accounting/overview`, { headers });
    if (overviewResponse.ok) {
      const overviewData = await overviewResponse.json();
      console.log(`✅ Overview: ${overviewData.data?.length || 0} records`);
    } else {
      console.log('❌ Overview failed:', await overviewResponse.text());
    }

    // Test 2: Get clients accounting
    console.log('👥 Testing clients accounting...');
    const clientsResponse = await fetch(`${API_BASE}/accounting/clients`, { headers });
    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json();
      console.log(`✅ Clients: ${clientsData.data?.length || 0} records, ${clientsData.summaries?.length || 0} summaries`);
    } else {
      console.log('❌ Clients failed:', await clientsResponse.text());
    }

    // Test 3: Get drivers accounting
    console.log('🚚 Testing drivers accounting...');
    const driversResponse = await fetch(`${API_BASE}/accounting/drivers`, { headers });
    if (driversResponse.ok) {
      const driversData = await driversResponse.json();
      console.log(`✅ Drivers: ${driversData.data?.length || 0} records, ${driversData.summaries?.length || 0} summaries`);
    } else {
      console.log('❌ Drivers failed:', await driversResponse.text());
    }

    // Test 4: Get third-party accounting
    console.log('🏢 Testing third-party accounting...');
    const thirdPartyResponse = await fetch(`${API_BASE}/accounting/third-party`, { headers });
    if (thirdPartyResponse.ok) {
      const thirdPartyData = await thirdPartyResponse.json();
      console.log(`✅ Third-party: ${thirdPartyData.data?.length || 0} records, ${thirdPartyData.summaries?.length || 0} summaries`);
    } else {
      console.log('❌ Third-party failed:', await thirdPartyResponse.text());
    }

    // Test 5: Get exchange rates
    console.log('💱 Testing exchange rates...');
    const ratesResponse = await fetch(`${API_BASE}/accounting/exchange-rates`, { headers });
    if (ratesResponse.ok) {
      const ratesData = await ratesResponse.json();
      console.log(`✅ Exchange rates: ${ratesData.data?.length || 0} records`);
    } else {
      console.log('❌ Exchange rates failed:', await ratesResponse.text());
    }

    // Test 6: Record payment
    console.log('💰 Testing payment recording...');
    const paymentData = {
      orderId: 123, // Use one of our test orders
      accountType: 'client',
      accountId: 52, // Use our test client
      amountUsd: 25.00,
      amountLbp: 0,
      method: 'cash',
      note: 'Test payment',
      createdBy: 1
    };

    const paymentResponse = await fetch(`${API_BASE}/accounting/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData)
    });

    if (paymentResponse.ok) {
      const paymentResult = await paymentResponse.json();
      console.log(`✅ Payment recorded: ID ${paymentResult.data?.id}`);
    } else {
      console.log('❌ Payment recording failed:', await paymentResponse.text());
    }

    // Test 7: Update order status
    console.log('📦 Testing order status update...');
    const statusResponse = await fetch(`${API_BASE}/accounting/orders/123/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'delivered' })
    });

    if (statusResponse.ok) {
      console.log('✅ Order status updated to delivered');
    } else {
      console.log('❌ Order status update failed:', await statusResponse.text());
    }

    // Test 8: Export client statement
    console.log('📄 Testing client statement export...');
    const exportResponse = await fetch(`${API_BASE}/accounting/export/client-statement/52?format=csv`, { headers });
    if (exportResponse.ok) {
      console.log('✅ Client statement export successful');
    } else {
      console.log('❌ Client statement export failed:', await exportResponse.text());
    }

  } catch (error) {
    console.error('❌ Testing error:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Accounting System Tests...');
  
  // Wait a bit for server to start
  console.log('⏳ Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const token = await authenticate();
  if (!token) {
    console.error('❌ Cannot proceed without authentication token');
    return;
  }

  console.log('✅ Authentication successful');
  await testAccountingEndpoints(token);
  
  console.log('🎉 Accounting system tests completed!');
}

// Run tests
runTests().catch(console.error);
