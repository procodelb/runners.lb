const { query, run } = require('./config/database');

class MCPLayer {
  constructor() {
    this.db = { query, run };
    this.initializationPromise = this.waitForInitialization();
  }

  async waitForInitialization() {
    // Wait for database to be ready
    let attempts = 0;
    const maxAttempts = 30; // Wait up to 30 seconds
    
    while (attempts < maxAttempts) {
      try {
        // Try a simple query to check if database is ready
        await this.db.query('SELECT 1 as test');
        console.log('✅ MCP Layer: Database is ready');
        return true;
      } catch (error) {
        if (error.message.includes('not initialized')) {
          console.log(`⏳ MCP Layer: Waiting for database initialization... (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        } else {
          // If it's a different error, the database might be ready but have other issues
          console.log('✅ MCP Layer: Database appears to be ready');
          return true;
        }
      }
    }
    
    throw new Error('Database initialization timeout after 30 seconds');
  }

  async ensureReady() {
    await this.initializationPromise;
  }

  async create(table, data) {
    await this.ensureReady();
    
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => data[col]);
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    try {
      const result = await this.db.run(sql, values);
      return result;
    } catch (error) {
      console.error(`MCP Create Error (${table}):`, error);
      throw error;
    }
  }

  async read(table, conditions = {}, options = {}) {
    await this.ensureReady();
    
    let sql = `SELECT * FROM ${table}`;
    const values = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    try {
      const result = await this.db.query(sql, values);
      return result;
    } catch (error) {
      console.error(`MCP Read Error (${table}):`, error);
      throw error;
    }
  }

  async update(table, id, data) {
    await this.ensureReady();
    
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ? RETURNING *`;
    
    try {
      const result = await this.db.run(sql, values);
      return result;
    } catch (error) {
      console.error(`MCP Update Error (${table}):`, error);
      throw error;
    }
  }

  async delete(table, id) {
    await this.ensureReady();
    
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    
    try {
      const result = await this.db.run(sql, [id]);
      return result;
    } catch (error) {
      console.error(`MCP Delete Error (${table}):`, error);
      throw error;
    }
  }

  async count(table, conditions = {}) {
    await this.ensureReady();
    
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const values = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }
    
    try {
      const result = await this.db.query(sql, values);
      return result[0]?.count || 0;
    } catch (error) {
      console.error(`MCP Count Error (${table}):`, error);
      throw error;
    }
  }

  async search(table, searchFields, searchTerm, options = {}) {
    await this.ensureReady();
    
    let sql = `SELECT * FROM ${table}`;
    const values = [];
    
    if (searchFields && searchFields.length > 0 && searchTerm) {
      const searchConditions = searchFields.map(field => `${field} ILIKE ?`);
      sql += ` WHERE ${searchConditions.join(' OR ')}`;
      values.push(...searchFields.map(() => `%${searchTerm}%`));
    }
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    try {
      const result = await this.db.query(sql, values);
      return result;
    } catch (error) {
      console.error(`MCP Search Error (${table}):`, error);
      throw error;
    }
  }

  async transaction(operations) {
    await this.ensureReady();
    
    try {
      // For now, execute operations sequentially
      // In a production environment, you'd want proper transaction handling
      const results = [];
      for (const operation of operations) {
        const result = await this[operation.type](operation.table, operation.data, operation.options);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('MCP Transaction Error:', error);
      throw error;
    }
  }

  async queryWithJoins(queryString, params = []) {
    await this.ensureReady();
    
    try {
      const result = await this.db.query(queryString, params);
      return result;
    } catch (error) {
      console.error('MCP QueryWithJoins Error:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.ensureReady();
      
      // Test basic database operations
      const testResult = await this.db.query('SELECT 1 as test');
      
      if (testResult && testResult.length > 0) {
        return {
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: 'connected'
        };
      } else {
        return {
          success: false,
          status: 'unhealthy',
          error: 'Database query returned no results',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const mcp = new MCPLayer();
module.exports = mcp;
