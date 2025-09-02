const { query, run } = require('../config/database');

/**
 * MCP (Model-Controller-Provider) Layer for Soufiam ERP
 * Provides clean, consistent interfaces for all database operations
 */

class MCPLayer {
  constructor() {
    this.db = { query, run };
  }

  // Generic CRUD operations
  async create(table, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map(() => '?').join(', ');
      
      const insertQuery = `
        INSERT INTO ${table} (${fields.join(', ')}) 
        VALUES (${placeholders}) 
        RETURNING *
      `;
      
      const result = await this.db.run(insertQuery, values);
      return { success: true, data: result, id: result.id };
    } catch (error) {
      console.error(`MCP Create Error (${table}):`, error);
      throw error;
    }
  }

  async read(table, conditions = {}, options = {}) {
    try {
      let whereClause = '';
      let params = [];
      
      if (Object.keys(conditions).length > 0) {
        const conditionsArray = Object.keys(conditions).map(key => `${key} = ?`);
        whereClause = `WHERE ${conditionsArray.join(' AND ')}`;
        params = Object.values(conditions);
      }
      
      const { limit, offset, orderBy, orderDirection = 'DESC' } = options;
      let queryString = `SELECT * FROM ${table} ${whereClause}`;
      
      if (orderBy) {
        queryString += ` ORDER BY ${orderBy} ${orderDirection}`;
      }
      
      if (limit) {
        queryString += ` LIMIT ?`;
        params.push(limit);
      }
      
      if (offset) {
        queryString += ` OFFSET ?`;
        params.push(offset);
      }
      
      const result = await this.db.query(queryString, params);
      return { success: true, data: result };
    } catch (error) {
      console.error(`MCP Read Error (${table}):`, error);
      throw error;
    }
  }

  async update(table, id, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      
      if (fields.length === 0) {
        throw new Error('No fields to update');
      }
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const updateQuery = `
        UPDATE ${table} 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      values.push(id);
      const result = await this.db.run(updateQuery, values);
      
      if (result.changes === 0) {
        throw new Error('Record not found');
      }
      
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error(`MCP Update Error (${table}):`, error);
      throw error;
    }
  }

  async delete(table, id) {
    try {
      const deleteQuery = `DELETE FROM ${table} WHERE id = ?`;
      const result = await this.db.run(deleteQuery, [id]);
      
      if (result.changes === 0) {
        throw new Error('Record not found');
      }
      
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error(`MCP Delete Error (${table}):`, error);
      throw error;
    }
  }

  // Count records
  async count(table, conditions = {}) {
    try {
      let whereClause = '';
      let params = [];
      
      if (Object.keys(conditions).length > 0) {
        const conditionsArray = Object.keys(conditions).map(key => `${key} = ?`);
        whereClause = `WHERE ${conditionsArray.join(' AND ')}`;
        params = Object.values(conditions);
      }
      
      const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
      const result = await this.db.query(countQuery, params);
      
      return parseInt(result[0]?.count || 0);
    } catch (error) {
      console.error(`MCP Count Error (${table}):`, error);
      throw error;
    }
  }

  // Search with pagination
  async search(table, searchFields, searchTerm, options = {}) {
    try {
      const { page = 1, limit = 20, orderBy, orderDirection = 'DESC' } = options;
      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      let params = [];
      
      if (searchTerm && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => `${field} LIKE ?`);
        whereConditions.push(`(${searchConditions.join(' OR ')})`);
        params.push(...searchFields.map(() => `%${searchTerm}%`));
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult[0]?.count || 0);
      
      // Get data with pagination
      let dataQuery = `SELECT * FROM ${table} ${whereClause}`;
      
      if (orderBy) {
        dataQuery += ` ORDER BY ${orderBy} ${orderDirection}`;
      }
      
      dataQuery += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const dataResult = await this.db.query(dataQuery, params);
      
      return {
        success: true,
        data: dataResult,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error(`MCP Search Error (${table}):`, error);
      throw error;
    }
  }

  // Transaction support
  async transaction(operations) {
    try {
      // Start transaction
      await this.db.run('BEGIN TRANSACTION');
      
      const results = [];
      for (const operation of operations) {
        const { type, table, data, id, conditions } = operation;
        
        switch (type) {
          case 'create':
            results.push(await this.create(table, data));
            break;
          case 'update':
            results.push(await this.update(table, id, data));
            break;
          case 'delete':
            results.push(await this.delete(table, id));
            break;
          default:
            throw new Error(`Unknown operation type: ${type}`);
        }
      }
      
      // Commit transaction
      await this.db.run('COMMIT');
      
      return { success: true, results };
    } catch (error) {
      // Rollback on error
      await this.db.run('ROLLBACK');
      console.error('MCP Transaction Error:', error);
      throw error;
    }
  }

  // Complex queries with joins
  async queryWithJoins(queryString, params = []) {
    try {
      const result = await this.db.query(queryString, params);
      return { success: true, data: result };
    } catch (error) {
      console.error('MCP Query Error:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.db.query('SELECT 1 as health_check');
      return { success: true, status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('MCP Health Check Error:', error);
      return { success: false, status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

// Create singleton instance
const mcp = new MCPLayer();

module.exports = mcp;
