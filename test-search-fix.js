const axios = require('axios');

async function testSearchFix() {
  const baseURL = 'http://localhost:5000/api';
  
  try {
    console.log('🧪 Testing search parameter fix...');
    
    // Test 1: Try to access /clients with search parameter (should work now)
    console.log('\n1. Testing /clients with search parameter:');
    try {
      const response = await axios.get(`${baseURL}/clients?search=test`);
      console.log('✅ Success:', response.status, response.data.success);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 2: Try to access /clients/search/test (should work)
    console.log('\n2. Testing /clients/search/test:');
    try {
      const response = await axios.get(`${baseURL}/clients/search/test`);
      console.log('✅ Success:', response.status, response.data.success);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 3: Try to access /clients/search (should fail with proper error)
    console.log('\n3. Testing /clients/search (invalid ID):');
    try {
      const response = await axios.get(`${baseURL}/clients/search`);
      console.log('✅ Success:', response.status, response.data.success);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 4: Try to access /price-list with search parameter
    console.log('\n4. Testing /price-list with search parameter:');
    try {
      const response = await axios.get(`${baseURL}/price-list?search=test`);
      console.log('✅ Success:', response.status, response.data.success);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 5: Try to access /price-list/search (should work)
    console.log('\n5. Testing /price-list/search:');
    try {
      const response = await axios.get(`${baseURL}/price-list/search?q=test`);
      console.log('✅ Success:', response.status, response.data.success);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message);
    }
    
    console.log('\n🎉 Search parameter fix test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait a bit for server to start, then run test
setTimeout(testSearchFix, 3000);
