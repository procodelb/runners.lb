const { query } = require('../config/database');

async function checkSchema() {
  try {
    // Wait for database initialization
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      try {
        await query('SELECT 1');
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Database initialization timeout');
        }
        console.log(`⏳ Waiting for database initialization... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('🔍 Checking database schema...');

    // Check if clients table exists
    const clientsColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Clients table columns:');
    if (clientsColumns.length === 0) {
      console.log('❌ Clients table does not exist');
    } else {
      clientsColumns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

    // Check all tables
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n📊 All tables in database:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkSchema();
