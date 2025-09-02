require('dotenv').config();

// Force Neon PostgreSQL usage - only fallback to SQLite if explicitly set
const useSQLite = String(process.env.USE_SQLITE || '').toLowerCase() === 'true';

let query;
let run;
let closeDatabase;
let currentDatabase = 'unknown';
let isInitialized = false;

async function initializeDatabase() {
  if (!useSQLite) {
    try {
      const { Pool } = require('pg');

      const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

      console.log('🔧 Attempting to connect to PostgreSQL (Neon)...');
      console.log('📡 Database URL:', DATABASE_URL.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

      const pool = new Pool({
        connectionString: DATABASE_URL,
        max: Number(process.env.PG_POOL_MAX || 10),
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
        ssl: {
          rejectUnauthorized: false,
          sslmode: 'require'
        },
        connectionTimeoutMillis: 10000
      });

      // Test the connection
      await pool.query('SELECT 1 as test');
      console.log('✅ Connected to PostgreSQL (Neon)');
      currentDatabase = 'postgresql';
      
      pool.on('connect', () => {
        console.log('✅ PostgreSQL connection established');
      });

      pool.on('error', (err) => {
        console.error('❌ PostgreSQL pool error:', err);
      });

      function toPgParams(sql, params) {
        if (!params || params.length === 0) return { text: sql, values: [] };
        let index = 0;
        const text = sql.replace(/\?/g, () => `$${++index}`);
        return { text, values: params };
      }

      query = async (sql, params = []) => {
        const start = Date.now();
        const { text, values } = toPgParams(sql, params);
        try {
          const result = await pool.query(text, values);
          const duration = Date.now() - start;
          console.log(`📊 Query executed in ${duration}ms: ${text.substring(0, 60)}...`);
          return result.rows || [];
        } catch (err) {
          console.error('❌ Query error:', err.message);
          console.error('SQL:', text);
          console.error('Params:', values);
          throw err;
        }
      };

      run = async (sql, params = []) => {
        const start = Date.now();
        let text = sql.trim();
        if (/^insert\s+/i.test(text) && !/returning\s+/i.test(text)) {
          text = `${text} RETURNING id`;
        }
        const { text: pgText, values } = toPgParams(text, params);
        try {
          const result = await pool.query(pgText, values);
          const duration = Date.now() - start;
          console.log(`📊 Run executed in ${duration}ms: ${pgText.substring(0, 60)}...`);
          if (/^insert\s+/i.test(pgText)) {
            const id = result.rows?.[0]?.id;
            return { id, changes: result.rowCount };
          }
          return { changes: result.rowCount };
        } catch (err) {
          console.error('❌ Run error:', err.message);
          console.error('SQL:', pgText);
          console.error('Params:', values);
          throw err;
        }
      };

      closeDatabase = async () => {
        await pool.end();
        console.log('✅ PostgreSQL pool closed');
      };

      module.exports.pool = pool;
      isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      console.log('🔄 Falling back to SQLite...');
      return false;
    }
  }
  return false;
}

async function initializeSQLite() {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening SQLite database:', err.message);
    } else {
      console.log('✅ Connected to SQLite database');
      console.log(`📁 Database file: ${dbPath}`);
      currentDatabase = 'sqlite';
    }
  });

  query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      db.all(sql, params, (err, rows) => {
        const duration = Date.now() - start;
        if (err) {
          console.error('❌ SQLite query error:', err.message);
          console.error('SQL:', sql);
          console.error('Params:', params);
          reject(err);
        } else {
          console.log(`📊 Query executed in ${duration}ms: ${String(sql).substring(0, 60)}...`);
          resolve(rows || []);
        }
      });
    });
  };

  run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      db.run(sql, params, function(err) {
        const duration = Date.now() - start;
        if (err) {
          console.error('❌ SQLite run error:', err.message);
          console.error('SQL:', sql);
          console.error('Params:', params);
          reject(err);
        } else {
          console.log(`📊 Run executed in ${duration}ms: ${String(sql).substring(0, 60)}...`);
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  };

  closeDatabase = async () => {
    await new Promise((resolve) => db.close(() => resolve()));
    console.log('✅ SQLite database closed');
  };

  isInitialized = true;
}

// Initialize database - enforce Neon PostgreSQL only (no SQLite fallback)
(async () => {
  if (useSQLite) {
    console.log('🔧 Using SQLite (explicitly configured)');
    await initializeSQLite();
  } else {
    console.log('🔧 Attempting to connect to Neon PostgreSQL...');
    const pgSuccess = await initializeDatabase();
    if (!pgSuccess) {
      console.error('❌ Neon connection failed. SQLite fallback is disabled. Exiting.');
      process.exit(1);
    }
    console.log('✅ Successfully connected to Neon PostgreSQL');
  }
})();

// Ensure functions are available even if not initialized yet
const ensureInitialized = () => {
  if (!isInitialized) {
    throw new Error('Database not initialized yet. Please wait for initialization to complete.');
  }
};

const getExchangeRate = async () => {
  try {
    if (currentDatabase === 'postgresql') {
      const rows = await query('SELECT lbp_per_usd FROM exchange_rates ORDER BY effective_at DESC LIMIT 1');
      const rate = rows[0]?.lbp_per_usd;
      return rate ? Number(rate) : Number(process.env.EXCHANGE_RATE || 89000);
    }
    return Number(process.env.EXCHANGE_RATE || 89000);
  } catch {
    return Number(process.env.EXCHANGE_RATE || 89000);
  }
};

const usdToLbp = async (usdAmount) => {
  const rate = await getExchangeRate();
  return Math.round(Number(usdAmount || 0) * rate);
};

const lbpToUsd = async (lbpAmount) => {
  const rate = await getExchangeRate();
  return Math.round((Number(lbpAmount || 0) / rate) * 100) / 100;
};

// Export functions with initialization check
module.exports.query = (...args) => {
  ensureInitialized();
  return query(...args);
};

module.exports.run = (...args) => {
  ensureInitialized();
  return run(...args);
};

module.exports.getExchangeRate = getExchangeRate;
module.exports.usdToLbp = usdToLbp;
module.exports.lbpToUsd = lbpToUsd;
module.exports.closeDatabase = closeDatabase;
module.exports.currentDatabase = () => currentDatabase;
module.exports.isInitialized = () => isInitialized;
