const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Connecting to Neon to seed demo user...');
    await pool.query('SELECT 1');

    const email = 'soufian@gmail.com';
    const password = 'Soufi@n123';
    const fullName = 'Soufian Admin';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('✅ Demo user already exists');
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ($1, $2, $3, 'admin')
      RETURNING id
    `;
    const result = await pool.query(insert, [email, hash, fullName]);
    console.log('✅ Demo user created with id:', result.rows[0].id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed demo user:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();


