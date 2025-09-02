const mcp = require('./mcp');

async function testMCP() {
  try {
    console.log('🧪 Testing MCP Layer...');
    
    // Test health check
    console.log('\n1. Testing health check...');
    const health = await mcp.healthCheck();
    console.log('Health check result:', health);
    
    // Test count operations
    console.log('\n2. Testing count operations...');
    const ordersCount = await mcp.count('orders');
    console.log('Orders count:', ordersCount);
    
    const clientsCount = await mcp.count('clients');
    console.log('Clients count:', clientsCount);
    
    const driversCount = await mcp.count('drivers');
    console.log('Drivers count:', driversCount);
    
    // Test read operations
    console.log('\n3. Testing read operations...');
    const recentOrders = await mcp.read('orders', {}, { limit: 3, orderBy: 'created_at DESC' });
    console.log('Recent orders:', recentOrders.length);
    
    const recentClients = await mcp.read('clients', {}, { limit: 3, orderBy: 'created_at DESC' });
    console.log('Recent clients:', recentClients.length);
    
    // Test search operations
    console.log('\n4. Testing search operations...');
    const searchResults = await mcp.search('clients', ['business_name', 'contact_person'], 'test', { limit: 5 });
    console.log('Search results:', searchResults.length);
    
    console.log('\n✅ MCP Layer test completed successfully!');
    
  } catch (error) {
    console.error('❌ MCP Layer test failed:', error);
  } finally {
    process.exit(0);
  }
}

testMCP();
