const { Pool } = require('pg');

// Try different connection methods
const connectionConfigs = [
  {
    name: 'Direct connection with SSL',
    config: {
      host: 'db.bvgznoimbfrvrmajaehh.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Runners_99732482',
      ssl: {
        rejectUnauthorized: false,
        sslmode: 'require'
      }
    }
  },
  {
    name: 'Connection string with different SSL mode',
    config: {
      connectionString: 'postgresql://postgres:Runners_99732482@db.bvgznoimbfrvrmajaehh.supabase.co:5432/postgres?sslmode=require'
    }
  },
  {
    name: 'Connection string with no SSL',
    config: {
      connectionString: 'postgresql://postgres:Runners_99732482@db.bvgznoimbfrvrmajaehh.supabase.co:5432/postgres?sslmode=disable'
    }
  }
];

async function testConnection(config, name) {
  const pool = new Pool(config);
  
  try {
    console.log(`\n🔍 Testing: ${name}`);
    const result = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ ${name} - SUCCESS!`);
    console.log('Current time:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.log(`❌ ${name} - FAILED:`, error.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('🔧 Testing different Supabase connection methods...');
  
  for (const connConfig of connectionConfigs) {
    await testConnection(connConfig.config, connConfig.name);
  }
  
  console.log('\n📋 Connection test summary completed.');
}

main().catch(console.error);
