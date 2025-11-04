const mcp = require('./mcp');

async function checkUsersTable() {
  try {
    console.log('🔍 Checking users table structure...\n');
    
    await mcp.ensureReady();
    
    // Check table structure
    console.log('1️⃣ Getting table structure...');
    const tableInfo = await mcp.queryWithJoins(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (tableInfo.length > 0) {
      console.log('📋 Users table columns:');
      tableInfo.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('❌ Users table does not exist');
      return;
    }
    
    // Check existing users
    console.log('\n2️⃣ Checking existing users...');
    const existingUsers = await mcp.queryWithJoins('SELECT id, email FROM users LIMIT 10');
    
    if (existingUsers.length > 0) {
      console.log('📋 Existing users:');
      existingUsers.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      });
    } else {
      console.log('📋 No users found in database');
    }
    
  } catch (error) {
    console.error('❌ Error checking users table:', error.message);
  }
}

if (require.main === module) {
  checkUsersTable();
}

module.exports = { checkUsersTable };
