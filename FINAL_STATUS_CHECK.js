// Final status check for the ERP system
const FRONTEND_URL = 'https://runners-lb.vercel.app';
const BACKEND_URL = 'https://soufiam-erp-backend.onrender.com';

console.log('🔍 FINAL STATUS CHECK');
console.log('====================');
console.log('');

async function checkBackend() {
  console.log('1️⃣ Checking Backend Status...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend: WORKING');
      console.log('📊 Response:', data);
      return true;
    } else {
      console.log('❌ Backend: NOT WORKING');
      console.log('📊 Status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Backend: CONNECTION ERROR');
    console.log('📊 Error:', error.message);
    return false;
  }
}

async function checkFrontend() {
  console.log('\n2️⃣ Checking Frontend Status...');
  try {
    const response = await fetch(FRONTEND_URL);
    if (response.ok) {
      console.log('✅ Frontend: ACCESSIBLE');
      console.log('📊 Status:', response.status);
      return true;
    } else {
      console.log('❌ Frontend: NOT ACCESSIBLE');
      console.log('📊 Status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend: CONNECTION ERROR');
    console.log('📊 Error:', error.message);
    return false;
  }
}

async function checkEnvironmentVariable() {
  console.log('\n3️⃣ Checking Environment Variable...');
  try {
    const response = await fetch(FRONTEND_URL);
    const html = await response.text();
    
    if (html.includes(BACKEND_URL)) {
      console.log('✅ Environment Variable: SET');
      console.log('📊 VITE_API_URL is working');
      return true;
    } else {
      console.log('❌ Environment Variable: NOT SET');
      console.log('📊 VITE_API_URL not found in HTML');
      return false;
    }
  } catch (error) {
    console.log('❌ Environment Variable: CHECK FAILED');
    console.log('📊 Error:', error.message);
    return false;
  }
}

async function runFinalCheck() {
  const backend = await checkBackend();
  const frontend = await checkFrontend();
  const envVar = await checkEnvironmentVariable();
  
  console.log('\n📋 FINAL STATUS:');
  console.log('================');
  console.log('Backend API:', backend ? '✅ WORKING' : '❌ NOT WORKING');
  console.log('Frontend:', frontend ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE');
  console.log('Environment Variable:', envVar ? '✅ SET' : '❌ NOT SET');
  
  if (backend && frontend && envVar) {
    console.log('\n🎉 SUCCESS! YOUR ERP SYSTEM IS FULLY WORKING!');
    console.log('🚀 Go to https://runners-lb.vercel.app and login!');
    console.log('📧 Email: soufian@gmail.com');
    console.log('🔑 Password: Soufi@n123');
  } else {
    console.log('\n⚠️  ISSUES DETECTED:');
    if (!backend) console.log('   - Backend API is not responding');
    if (!frontend) console.log('   - Frontend is not accessible');
    if (!envVar) console.log('   - Environment variable not set');
    
    console.log('\n🔧 NEXT STEPS:');
    if (!backend) {
      console.log('   1. Check Render dashboard for backend errors');
      console.log('   2. Verify environment variables on Render');
    }
    if (!envVar) {
      console.log('   1. Go to Vercel dashboard');
      console.log('   2. Set VITE_API_URL environment variable');
      console.log('   3. Redeploy the project');
    }
  }
}

runFinalCheck().catch(console.error);
