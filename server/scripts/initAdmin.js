const bcrypt = require('bcryptjs');
const db = require('../config/database');

(async () => {
  try {
    const email = 'runners.lb@gmail.com';
    const plainPassword = '123456789';
    const fullName = 'System Admin';
    const role = 'admin';

    // Wait for DB init
    let attempts = 0;
    while (!db.isInitialized() && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (!db.isInitialized()) throw new Error('Database initialization timeout');

    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    const hashed = await bcrypt.hash(plainPassword, 10);
    const insertSql = `INSERT INTO users (email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, now())`;
    const res = await db.run(insertSql, [email, hashed, fullName, role]);
    console.log('✅ Admin user created with id:', res.id);
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed to init admin:', e.message);
    process.exit(1);
  }
})();
