const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

class DatabaseMigrator {
  constructor() {
    this.sqlitePath = path.join(__dirname, '..', 'database.sqlite');
    this.pgPool = null;
    this.sqliteDb = null;
  }

  async connectToSQLite() {
    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(this.sqlitePath, (err) => {
        if (err) {
          console.error('❌ Error connecting to SQLite:', err.message);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async connectToPostgreSQL() {
    try {
      const DATABASE_URL = process.env.DATABASE_URL;
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL not found in environment variables');
      }

      this.pgPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
          sslmode: 'require'
        }
      });

      // Test connection
      await this.pgPool.query('SELECT 1 as test');
      console.log('✅ Connected to PostgreSQL database');
      return true;
    } catch (error) {
      console.error('❌ Error connecting to PostgreSQL:', error.message);
      return false;
    }
  }

  async getSQLiteTables() {
    return new Promise((resolve, reject) => {
      this.sqliteDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.name));
        }
      });
    });
  }

  async getSQLiteData(tableName) {
    return new Promise((resolve, reject) => {
      this.sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async migrateTable(tableName, data) {
    if (data.length === 0) {
      console.log(`📋 Table ${tableName}: No data to migrate`);
      return;
    }

    console.log(`🔄 Migrating ${data.length} records from ${tableName}...`);

    // Per-table mapping from SQLite schema -> Neon schema
    const buildInsert = (targetTable, sourceRow) => {
      let targetColumns = [];
      let values = [];

      const push = (col, val) => { targetColumns.push(col); values.push(val); };

      if (targetTable === 'users') {
        // Map: password -> password_hash
        push('id', sourceRow.id);
        push('email', sourceRow.email);
        push('password_hash', sourceRow.password || sourceRow.password_hash);
        push('full_name', sourceRow.full_name || sourceRow.name || '');
        push('role', sourceRow.role || 'admin');
        push('language', sourceRow.language || 'en');
        push('theme', sourceRow.theme || 'light');
        push('created_at', sourceRow.created_at);
        push('updated_at', sourceRow.updated_at);
      } else if (targetTable === 'transactions') {
        // Map: type -> tx_type; optionally map references
        push('id', sourceRow.id);
        push('tx_type', sourceRow.type || sourceRow.tx_type);
        push('amount_usd', sourceRow.amount_usd || 0);
        push('amount_lbp', sourceRow.amount_lbp || 0);
        push('actor_type', sourceRow.actor_type || null);
        push('actor_id', sourceRow.actor_id || null);
        push('debit_account', sourceRow.debit_account || null);
        push('credit_account', sourceRow.credit_account || null);
        push('description', sourceRow.description || null);
        // Map order reference if present
        const orderId = (sourceRow.reference_table === 'orders') ? sourceRow.reference_id : null;
        push('order_id', orderId);
        push('created_by', sourceRow.created_by || null);
        push('created_at', sourceRow.created_at);
      } else if (targetTable === 'cashbox_entries' || targetTable === 'cashbox') {
        // In SQLite, table name was 'cashbox' representing entries. Migrate into Neon 'cashbox_entries'.
        // We'll normalize both names to 'cashbox_entries'
        const entry = sourceRow;
        push('id', entry.id);
        push('entry_type', entry.entry_type || entry.type);
        push('amount_usd', entry.amount_usd || 0);
        push('amount_lbp', entry.amount_lbp || 0);
        push('actor_type', entry.actor_type || null);
        push('actor_id', entry.actor_id || entry.driver_id || null);
        push('description', entry.description || null);
        push('created_by', entry.created_by || null);
        push('created_at', entry.created_at);
        targetTable = 'cashbox_entries';
        return { targetTable, targetColumns, values };
      } else if (targetTable === 'price_list') {
        push('id', sourceRow.id);
        push('country', sourceRow.country || 'Lebanon');
        // SQLite used 'area' and PG uses 'area' in ensureNeonSetup
        push('area', sourceRow.area || sourceRow.area_name);
        // SQLite used fees_*; PG uses fees_* as well
        push('fees_lbp', sourceRow.fees_lbp || sourceRow.fee_lbp || 0);
        push('fees_usd', sourceRow.fees_usd || sourceRow.fee_usd || 0);
        push('created_at', sourceRow.created_at);
        push('updated_at', sourceRow.updated_at);
      } else if (targetTable === 'orders') {
        // Columns mostly align
        const cols = [
          'id','order_ref','type','is_purchase','customer_phone','customer_name','customer_address',
          'brand_name','voucher_code','deliver_method','third_party_name','third_party_fee_usd','third_party_fee_lbp',
          'driver_id','driver_fee_usd','driver_fee_lbp','instant','notes','status','payment_status',
          'total_usd','total_lbp','delivery_fee_usd','delivery_fee_lbp','created_by','created_at','updated_at','completed_at'
        ];
        for (const c of cols) {
          push(c, sourceRow[c]);
        }
      } else if (targetTable === 'drivers') {
        const cols = ['id','full_name','phone','address','notes','active','default_fee_lbp','default_fee_usd','created_at','updated_at'];
        for (const c of cols) push(c, sourceRow[c]);
      } else if (targetTable === 'clients') {
        const cols = ['id','business_name','contact_person','phone','address','instagram','website','google_location','category','created_at','updated_at'];
        for (const c of cols) push(c, sourceRow[c]);
      } else {
        // Default: attempt 1:1 mapping by keys present
        const columns = Object.keys(sourceRow);
        for (const c of columns) push(c, sourceRow[c]);
      }

      return { targetTable, targetColumns, values };
    };

    const upsert = async (targetTable, row) => {
      const { targetTable: tbl, targetColumns, values } = buildInsert(targetTable, row);
      const placeholders = targetColumns.map((_, idx) => `$${idx + 1}`).join(', ');
      let sql;
      if (tbl === 'users') {
        // Upsert on unique email, preserve existing password_hash if incoming is null
        const setClause = targetColumns
          .filter(c => c !== 'id' && c !== 'email')
          .map((c) => {
            if (c === 'password_hash') {
              return `${c} = COALESCE(EXCLUDED.${c}, ${tbl}.${c})`;
            }
            return `${c} = EXCLUDED.${c}`;
          })
          .join(', ');
        sql = `INSERT INTO ${tbl} (${targetColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (email) DO UPDATE SET ${setClause}`;
      } else {
        const setClause = targetColumns
          .filter(c => c !== 'id')
          .map((c) => `${c} = EXCLUDED.${c}`)
          .join(', ');
        sql = `INSERT INTO ${tbl} (${targetColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${setClause}`;
      }
      await this.pgPool.query(sql, values);
    };

    try {
      for (const row of data) {
        const target = (tableName === 'cashbox') ? 'cashbox_entries' : tableName;
        await upsert(target, row);
      }
      console.log(`✅ Successfully migrated ${data.length} records from ${tableName}`);
    } catch (error) {
      console.error(`❌ Error migrating ${tableName}:`, error.message);
      throw error;
    }
  }

  async migrateAllData() {
    try {
      const tables = await this.getSQLiteTables();
      console.log(`📋 Found ${tables.length} tables: ${tables.join(', ')}`);

      for (const tableName of tables) {
        if (tableName === 'sqlite_sequence') continue; // Skip SQLite internal table
        
        const data = await this.getSQLiteData(tableName);
        await this.migrateTable(tableName, data);
      }

      console.log('🎉 Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  async close() {
    if (this.sqliteDb) {
      await new Promise((resolve) => this.sqliteDb.close(() => resolve()));
      console.log('✅ SQLite connection closed');
    }
    if (this.pgPool) {
      await this.pgPool.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

async function main() {
  const migrator = new DatabaseMigrator();

  try {
    console.log('🚀 Starting database migration from SQLite to PostgreSQL...\n');

    // Connect to SQLite
    await migrator.connectToSQLite();

    // Try to connect to PostgreSQL
    const pgConnected = await migrator.connectToPostgreSQL();
    if (!pgConnected) {
      console.log('\n❌ Cannot connect to PostgreSQL. Please check your DATABASE_URL configuration.');
      console.log('💡 Make sure your Supabase project is accessible and the credentials are correct.');
      return;
    }

    // Migrate data
    await migrator.migrateAllData();

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await migrator.close();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseMigrator;
