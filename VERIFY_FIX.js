// Verification script to test if the fix worked
const FRONTEND_URL = 'https://runners-lb.vercel.app';
const BACKEND_URL = 'https://soufiam-erp-backend.onrender.com';

console.log('🔍 VERIFYING THE FIX...');
console.log('========================');
console.log('');

async function verifyFix() {
  console.log('1️⃣ Testing Frontend Configuration...');
  
  try {
    const response = await fetch(FRONTEND_URL);
    const html = await response.text();
    
    // Check if the HTML now contains the API URL
    if (html.includes(BACKEND_URL)) {
      console.log('✅ SUCCESS! Frontend now contains API URL');
      console.log('✅ VITE_API_URL environment variable is set!');
      return true;
    } else {
      console.log('❌ Still missing API URL in frontend');
      console.log('❌ VITE_API_URL environment variable not set yet');
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing frontend:', error.message);
    return false;
  }
}

async function testLogin() {
  console.log('\n2️⃣ Testing Login Functionality...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL,
      },
      body: JSON.stringify({
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend login API working perfectly');
      console.log('✅ User data:', data.data.user.email);
      return true;
    } else {
      console.log('❌ Backend login API failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing login:', error.message);
    return false;
  }
}

async function runVerification() {
  const frontendFixed = await verifyFix();
  const loginWorking = await testLogin();
  
  console.log('\n📋 VERIFICATION RESULTS:');
  console.log('=========================');
  console.log('Frontend Configuration:', frontendFixed ? '✅ FIXED' : '❌ NOT FIXED');
  console.log('Backend Login API:', loginWorking ? '✅ WORKING' : '❌ NOT WORKING');
  
  if (frontendFixed && loginWorking) {
    console.log('\n🎉 SUCCESS! YOUR ERP SYSTEM IS NOW FULLY WORKING!');
    console.log('🚀 Go to https://runners-lb.vercel.app and login!');
    console.log('📧 Email: soufian@gmail.com');
    console.log('🔑 Password: Soufi@n123');
  } else if (!frontendFixed) {
    console.log('\n⚠️  VITE_API_URL environment variable still not set');
    console.log('🔧 Go to Vercel dashboard and set it now!');
  } else {
    console.log('\n⚠️  Something else is wrong');
    console.log('🔧 Check the error messages above');
  }
}

runVerification().catch(console.error);
