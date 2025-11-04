const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2a8b9c3d4e5f@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkSchema() {
  try {
    console.log('🔍 Checking drivers table schema...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' 
      ORDER BY ordinal_position
    `);
    
    console.log('Drivers table columns:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check if balance columns exist
    const hasOldBalanceUsd = result.rows.some(row => row.column_name === 'old_balance_usd');
    const hasOldBalanceLbp = result.rows.some(row => row.column_name === 'old_balance_lbp');
    
    console.log('\n📊 Balance columns status:');
    console.log(`- old_balance_usd: ${hasOldBalanceUsd ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`- old_balance_lbp: ${hasOldBalanceLbp ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!hasOldBalanceUsd || !hasOldBalanceLbp) {
      console.log('\n🔧 Adding missing balance columns...');
      if (!hasOldBalanceUsd) {
        await pool.query('ALTER TABLE drivers ADD COLUMN old_balance_usd DECIMAL(10,2) DEFAULT 0');
        console.log('✅ Added old_balance_usd column');
      }
      if (!hasOldBalanceLbp) {
        await pool.query('ALTER TABLE drivers ADD COLUMN old_balance_lbp DECIMAL(10,2) DEFAULT 0');
        console.log('✅ Added old_balance_lbp column');
      }
    }
    
    await pool.end();
    console.log('✅ Schema check completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

checkSchema();
