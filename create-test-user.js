const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';

async function createTestUser() {
  console.log('🔧 Creating test user...');
  
  try {
    // First, try to signup a test user
    const signupResponse = await axios.post(`${BACKEND_URL}/api/auth/signup`, {
      email: 'test@example.com',
      password: 'test123',
      full_name: 'Test User'
    });
    
    console.log('✅ Test user created successfully');
    console.log('User data:', signupResponse.data);
    
    return signupResponse.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('ℹ️ Test user already exists, trying to login...');
      
      // Try to login with existing user
      try {
        const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
          email: 'test@example.com',
          password: 'test123'
        });
        
        console.log('✅ Test user login successful');
        return loginResponse.data;
      } catch (loginError) {
        console.log('❌ Test user login failed:', loginError.response?.data?.message);
        throw loginError;
      }
    } else {
      console.log('❌ Failed to create test user:', error.response?.data?.message);
      throw error;
    }
  }
}

// Run the function
createTestUser().then(() => {
  console.log('🎉 Test user setup completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test user setup failed:', error.message);
  process.exit(1);
});
