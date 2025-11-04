// Test third party filter
const fetch = require('node-fetch');

async function testThirdPartyFilter() {
  console.log('🧪 Testing third party filter...\n');
  
  try {
    // Test without authentication first to see the response
    const response = await fetch('http://localhost:5000/api/orders?delivery_mode=third_party');
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testThirdPartyFilter();
