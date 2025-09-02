// Simple test to verify login works
import fetch from 'node-fetch';

async function testLogin() {
  try {
    console.log('🧪 Testing login...');
    
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data.token) {
      console.log('✅ Login successful!');
      
      // Test /me endpoint
      console.log('\n🧪 Testing /me endpoint...');
      const meResponse = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.data.token}`,
          'Content-Type': 'application/json',
        }
      });

      const meData = await meResponse.json();
      console.log('Me Status:', meResponse.status);
      console.log('Me Response:', JSON.stringify(meData, null, 2));

      if (meData.success) {
        console.log('✅ /me endpoint working!');
      } else {
        console.log('❌ /me endpoint failed');
      }
    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLogin();
