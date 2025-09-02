const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database file path
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Create SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database');
    console.log(`📁 Database file: ${dbPath}`);
    
    // Run migration
    migrateCrmToClients();
  }
});

// Migration function
const migrateCrmToClients = () => {
  console.log('🔄 Starting CRM to Clients migration...');

  // Check if crm table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='crm'", (err, row) => {
    if (err) {
      console.error('❌ Error checking crm table:', err);
      return;
    }

    if (!row) {
      console.log('ℹ️  No crm table found, skipping migration');
      db.close();
      return;
    }

    console.log('📋 Found crm table, starting migration...');

    // Get all data from crm table
    db.all("SELECT * FROM crm", (err, rows) => {
      if (err) {
        console.error('❌ Error reading crm table:', err);
        return;
      }

      console.log(`📊 Found ${rows.length} records to migrate`);

      if (rows.length === 0) {
        console.log('ℹ️  No records to migrate');
        db.close();
        return;
      }

      // Begin transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Insert each record into clients table
        const stmt = db.prepare(`
          INSERT INTO clients (
            business_name, contact_person, phone, address, 
            instagram, website, google_location, category,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        rows.forEach((row, index) => {
          // Parse instagram_website field
          let instagram = '';
          let website = '';
          if (row.instagram_website) {
            const parts = row.instagram_website.split(' | ');
            instagram = parts[0] || '';
            website = parts[1] || '';
          }

          stmt.run([
            row.business_name,
            row.contact_person,
            row.phone,
            row.address,
            instagram,
            website,
            row.location_google,
            row.category,
            row.created_at,
            row.updated_at
          ], (err) => {
            if (err) {
              console.error(`❌ Error migrating record ${index + 1}:`, err);
            } else {
              console.log(`✅ Migrated record ${index + 1}: ${row.business_name}`);
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('❌ Error finalizing migration:', err);
            db.run('ROLLBACK');
            db.close();
            return;
          }

          // Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('❌ Error committing migration:', err);
              db.run('ROLLBACK');
            } else {
              console.log('✅ Migration completed successfully!');
              
              // Drop old crm table
              db.run('DROP TABLE crm', (err) => {
                if (err) {
                  console.error('⚠️  Warning: Could not drop old crm table:', err);
                } else {
                  console.log('🗑️  Old crm table dropped');
                }
                db.close();
              });
            }
          });
        });
      });
    });
  });
};

// Handle process exit
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted by user');
  db.close();
  process.exit(0);
});

process.on('exit', () => {
  console.log('👋 Migration script finished');
});

