const { query, run } = require('../config/database');
const bcrypt = require('bcryptjs');

async function createTestUser() {
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

    console.log('👤 Creating test user...');

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = ?', ['admin@soufiam.com']);
    if (existingUser.length > 0) {
      console.log('✅ Test user already exists');
      return existingUser[0].id;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const result = await run(`
      INSERT INTO users (email, password_hash, full_name, role, created_at)
      VALUES (?, ?, ?, ?, now())
    `, ['admin@soufiam.com', hashedPassword, 'Admin User', 'admin']);

    console.log(`✅ Created test user: admin@soufiam.com (ID: ${result.id})`);
    return result.id;

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('✅ Test user creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test user creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestUser };
