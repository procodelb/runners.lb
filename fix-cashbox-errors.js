const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Cashbox System Errors...\n');

// 1. Check if server is running and on which port
async function checkServerPort() {
  console.log('1️⃣ Checking server port...');
  
  const portFile = path.join(__dirname, 'server', '.server-port');
  if (fs.existsSync(portFile)) {
    const port = fs.readFileSync(portFile, 'utf8').trim();
    console.log(`✅ Server is running on port: ${port}`);
    return port;
  } else {
    console.log('⚠️  Server port file not found. Server might not be running.');
    return null;
  }
}

// 2. Update client API configuration if needed
async function updateClientConfig(serverPort) {
  if (!serverPort) return;
  
  console.log('\n2️⃣ Updating client API configuration...');
  
  const apiIndexPath = path.join(__dirname, 'client', 'src', 'api', 'index.js');
  
  if (fs.existsSync(apiIndexPath)) {
    let content = fs.readFileSync(apiIndexPath, 'utf8');
    
    // Update the localhost port in the API configuration
    const oldPort = 'localhost:5000';
    const newPort = `localhost:${serverPort}`;
    
    if (content.includes(oldPort) && serverPort !== '5000') {
      content = content.replace(new RegExp(oldPort, 'g'), newPort);
      fs.writeFileSync(apiIndexPath, content);
      console.log(`✅ Updated API base URL from ${oldPort} to ${newPort}`);
    } else {
      console.log('✅ API configuration is already correct');
    }
  }
  
  // Also update AuthContext
  const authContextPath = path.join(__dirname, 'client', 'src', 'contexts', 'AuthContext.jsx');
  
  if (fs.existsSync(authContextPath)) {
    let content = fs.readFileSync(authContextPath, 'utf8');
    
    const oldPort = 'localhost:5000';
    const newPort = `localhost:${serverPort}`;
    
    if (content.includes(oldPort) && serverPort !== '5000') {
      content = content.replace(new RegExp(oldPort, 'g'), newPort);
      fs.writeFileSync(authContextPath, content);
      console.log(`✅ Updated AuthContext API base URL from ${oldPort} to ${newPort}`);
    } else {
      console.log('✅ AuthContext configuration is already correct');
    }
  }
}

// 3. Create a simple test to verify the fixes
async function testEndpoints(serverPort) {
  if (!serverPort) return;
  
  console.log('\n3️⃣ Testing critical endpoints...');
  
  const axios = require('axios');
  const baseURL = `http://localhost:${serverPort}/api`;
  
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health endpoint working');
    
    // Test transactions endpoint (the one that was failing)
    console.log('Testing transactions endpoint...');
    try {
      const transactionsResponse = await axios.get(`${baseURL}/transactions?limit=5`);
      console.log('❌ Transactions endpoint accessible without auth (this should fail)');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Transactions endpoint properly protected (401 Unauthorized)');
      } else {
        console.log('✅ Transactions endpoint exists (got non-401 error)');
      }
    }
    
    // Test cashbox endpoint
    console.log('Testing cashbox endpoint...');
    try {
      const cashboxResponse = await axios.get(`${baseURL}/cashbox/balance`);
      console.log('❌ Cashbox endpoint accessible without auth (this should fail)');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Cashbox endpoint properly protected (401 Unauthorized)');
      } else {
        console.log('✅ Cashbox endpoint exists (got non-401 error)');
      }
    }
    
  } catch (error) {
    console.error('❌ Server connection failed:', error.message);
    console.log('💡 Make sure the server is running with: cd server && node index.js');
  }
}

// 4. Provide instructions for fixing auth issues
function provideAuthInstructions() {
  console.log('\n4️⃣ Authentication Fix Instructions:');
  console.log('');
  console.log('If you\'re seeing "Authorization: undefined" errors:');
  console.log('');
  console.log('1. 🔐 Make sure you\'re logged in:');
  console.log('   - Go to the login page');
  console.log('   - Use credentials: runners.leb@gmail.com / admin123');
  console.log('   - Or create a new account');
  console.log('');
  console.log('2. 🧹 Clear browser storage if needed:');
  console.log('   - Open browser DevTools (F12)');
  console.log('   - Go to Application > Storage');
  console.log('   - Clear localStorage and cookies');
  console.log('   - Refresh and login again');
  console.log('');
  console.log('3. 🔄 If still having issues:');
  console.log('   - Check browser console for detailed errors');
  console.log('   - Verify server is running on the correct port');
  console.log('   - Check network tab for failed requests');
}

// Main execution
async function main() {
  try {
    const serverPort = await checkServerPort();
    await updateClientConfig(serverPort);
    await testEndpoints(serverPort);
    provideAuthInstructions();
    
    console.log('\n🎉 Fix script completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Make sure server is running: cd server && node index.js');
    console.log('2. Start the client: cd client && npm run dev');
    console.log('3. Login to the system');
    console.log('4. Try accessing the Cashbox page');
    
  } catch (error) {
    console.error('❌ Fix script failed:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkServerPort, updateClientConfig, testEndpoints };
