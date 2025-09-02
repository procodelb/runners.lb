const bcrypt = require('bcryptjs');
const { query, run } = require('../config/database');

async function initDemoUser() {
  try {
    console.log('🔧 Initializing demo user...');

    // Check if demo user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = ?', ['soufian@gmail.com']);
    
    if (existingUser.length > 0) {
      console.log('✅ Demo user already exists');
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('Soufi@n123', saltRounds);

    // Create demo user
    const insertQuery = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, ?, ?, 'admin')
    `;

    const result = await run(insertQuery, ['soufian@gmail.com', hashedPassword, 'Soufian Admin']);

    console.log('✅ Demo user created successfully');
    console.log('📧 Email: soufian@gmail.com');
    console.log('🔑 Password: Soufi@n123');
    console.log('🆔 User ID:', result.id);

  } catch (error) {
    console.error('❌ Error creating demo user:', error);
  }
}

// Run the initialization
initDemoUser();
