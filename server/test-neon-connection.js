require('dotenv').config();
const { Pool } = require('pg');

// Set environment variables directly
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.PG_SSL = 'true';

console.log('Environment variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('USE_SQLITE:', process.env.USE_SQLITE);
console.log('PG_SSL:', process.env.PG_SSL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 1
});

async function testConnection() {
  try {
    console.log('Testing connection to Neon PostgreSQL...');
    console.log('Attempting to connect with SSL...');
    
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Connection successful!');
    console.log('Current time from database:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].pg_version);
    
    // Test if we can create a table
    console.log('Testing table creation...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        test_time TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Table creation test successful!');
    
    // Clean up test table
    await pool.query('DROP TABLE IF EXISTS test_connection');
    console.log('✅ Cleanup successful!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
  } finally {
    await pool.end();
  }
}

testConnection();
