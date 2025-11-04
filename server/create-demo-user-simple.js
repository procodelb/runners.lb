const { query, run } = require('./config/database');
const bcrypt = require('bcryptjs');

async function createDemoUser() {
  try {
    console.log('🔧 Creating demo user for accounting system...\n');
    
    // Wait for database initialization
    console.log('⏳ Waiting for database initialization...');
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
    console.log('✅ Database initialized');
    
    // Demo credentials from login page
    const demoEmail = 'soufian@gmail.com';
    const demoPassword = 'Soufi@n123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    
    console.log('1️⃣ Checking if demo user exists...');
    const existingUser = await query('SELECT id, email FROM users WHERE email = $1', [demoEmail]);
    
    if (existingUser.length > 0) {
      console.log('⚠️  Demo user already exists, updating password...');
      await run(
        'UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2',
        [hashedPassword, demoEmail]
      );
      console.log('✅ Password updated for existing demo user');
    } else {
      console.log('➕ Creating new demo user...');
      await run(`
        INSERT INTO users (email, password_hash, full_name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
      `, [demoEmail, hashedPassword, 'Soufian Admin', 'admin']);
      console.log('✅ Demo user created successfully');
    }
    
    console.log('\n🎉 Demo user setup completed!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('👤 Email: soufian@gmail.com');
    console.log('🔑 Password: Soufi@n123');
    console.log('\n💡 You can now login to the accounting system!');
    
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
  }
}

if (require.main === module) {
  createDemoUser().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { createDemoUser };
