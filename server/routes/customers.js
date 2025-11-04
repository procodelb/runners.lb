const express = require('express');
const { query } = require('../config/database');
const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
  try {
    const customers = await query(`
      SELECT phone, name, COALESCE(address, '') as address, created_at, updated_at
      FROM customers 
      ORDER BY name ASC
    `);
    
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
});

// Search customers by phone or name
router.get('/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    const searchTerm = `%${term}%`;
    
    const customers = await query(`
      SELECT phone, name, COALESCE(address, '') as address, created_at, updated_at
      FROM customers 
      WHERE phone ILIKE $1 OR name ILIKE $1
      ORDER BY 
        CASE 
          WHEN phone ILIKE $1 THEN 1
          ELSE 2
        END,
        name ASC
      LIMIT 10
    `, [searchTerm]);
    
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search customers',
      error: error.message
    });
  }
});

// Create or update customer
router.post('/', async (req, res) => {
  try {
    const { phone, name, address } = req.body;
    
    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        message: 'Phone and name are required'
      });
    }
    
    // Check if customer exists
    const existingCustomers = await query(`
      SELECT phone FROM customers WHERE phone = $1
    `, [phone]);
    
    if (existingCustomers.length > 0) {
      // Update existing customer
      await query(`
        UPDATE customers 
        SET name = $1, address = $2, updated_at = now()
        WHERE phone = $3
      `, [name, address, phone]);
      
      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: { phone, name, address }
      });
    } else {
      // Create new customer
      await query(`
        INSERT INTO customers (phone, name, address)
        VALUES ($1, $2, $3)
      `, [phone, name, address]);
      
      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { phone, name, address }
      });
    }
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update customer',
      error: error.message
    });
  }
});

// Update customer
router.put('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { name, address } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }
    
    const result = await query(`
      UPDATE customers 
      SET name = $1, address = $2, updated_at = now()
      WHERE phone = $3
      RETURNING phone, name, address, created_at, updated_at
    `, [name, address, phone]);
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
});

// Get or create customer (for order forms)
// IMPORTANT: This route MUST be defined before /:phone to avoid route conflicts
router.post('/get-or-create', async (req, res) => {
  try {
    const { phone, name, address } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone is required'
      });
    }
    
    // Check if customer exists
    const existingCustomers = await query(`
      SELECT phone, name, COALESCE(address, '') as address, created_at, updated_at
      FROM customers 
      WHERE phone = $1
    `, [phone]);
    
    if (existingCustomers.length > 0) {
      // Return existing customer
      res.json({
        success: true,
        data: existingCustomers[0],
        created: false
      });
    } else {
      // Create new customer if name is provided
      if (name) {
        await query(`
          INSERT INTO customers (phone, name, address)
          VALUES ($1, $2, $3)
        `, [phone, name, address || '']);
        
        const newCustomer = await query(`
          SELECT phone, name, COALESCE(address, '') as address, created_at, updated_at
          FROM customers 
          WHERE phone = $1
        `, [phone]);
        
        res.status(201).json({
          success: true,
          data: newCustomer[0],
          created: true
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Customer not found and no name provided for creation'
        });
      }
    }
  } catch (error) {
    console.error('Error getting or creating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get or create customer',
      error: error.message
    });
  }
});

// Get customer by phone
// IMPORTANT: This route MUST be defined after /get-or-create to avoid route conflicts
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const customers = await query(`
      SELECT phone, name, COALESCE(address, '') as address, created_at, updated_at
      FROM customers 
      WHERE phone = $1
    `, [phone]);
    
    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customers[0]
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error.message
    });
  }
});

// Delete customer
router.delete('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const result = await query(`
      DELETE FROM customers 
      WHERE phone = $1
      RETURNING phone, name, address
    `, [phone]);
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer deleted successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
});

module.exports = router;
