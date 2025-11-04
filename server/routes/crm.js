const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all clients with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      category = '',
      client_type = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (search) {
      filterConditions.push(`(business_name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR client_type LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      filterConditions.push(`category = ?`);
      filterParams.push(category);
    }

    if (client_type) {
      filterConditions.push(`client_type = ?`);
      filterParams.push(client_type);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM clients ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get clients with pagination
    const clientsQuery = `
      SELECT * FROM clients
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const clientsResult = await query(clientsQuery, filterParams);

    res.json({
      success: true,
      data: clientsResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch clients',
      error: error.message 
    });
  }
});

// Search clients - MUST come before /:id route
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query: searchQuery } = req.params;
    
    const searchSql = `
      SELECT 
        id,
        business_name,
        contact_person,
        phone,
        address,
        instagram,
        website,
        google_location,
        category,
        COALESCE(client_type, 'BUSINESS') as client_type
      FROM clients 
      WHERE business_name LIKE ? OR contact_person LIKE ? OR phone LIKE ?
      ORDER BY business_name
      LIMIT 10
    `;
    
    const result = await query(searchSql, [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search clients',
      error: error.message 
    });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number to prevent search parameter confusion
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid client ID. ID must be a number.' 
      });
    }
    
    const clientQuery = 'SELECT * FROM clients WHERE id = ?';
    const result = await query(clientQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch client',
      error: error.message 
    });
  }
});

// Create new client
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      client_type, // 'BUSINESS' or 'INDIVIDUAL'
      business_name, // For BUSINESS type
      client_name, // For INDIVIDUAL type (will be stored as business_name)
      contact_person,
      phone,
      address,
      instagram,
      website,
      google_map_link,
      category // Only for BUSINESS type
    } = req.body;

    if (!client_type || !['BUSINESS', 'INDIVIDUAL'].includes(client_type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client type is required and must be BUSINESS or INDIVIDUAL' 
      });
    }

    if (client_type === 'BUSINESS' && !business_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Business name is required for BUSINESS clients' 
      });
    }

    if (client_type === 'INDIVIDUAL' && !client_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client name is required for INDIVIDUAL clients' 
      });
    }

    // Use MCP layer for client creation
    const clientData = {
      client_type,
      business_name: client_type === 'BUSINESS' ? business_name : client_name,
      contact_person: contact_person || '',
      phone: phone || '',
      address: address || '',
      instagram: instagram || '',
      website: website || '',
      google_location: google_map_link || '',
      category: client_type === 'BUSINESS' ? (category || '') : ''
    };

    const result = await mcp.create('clients', clientData);

    // Fetch the created client
    const clientQuery = 'SELECT * FROM clients WHERE id = ?';
    const clientResult = await query(clientQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: clientResult[0]
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create client',
      error: error.message 
    });
  }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid client ID. ID must be a number.' 
      });
    }
    
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    // Handle Google location fields - map google_map_link to google_location
    if (updateData.google_map_link) {
      updateData.google_location = updateData.google_map_link;
      delete updateData.google_map_link;
    }
    
    if (updateData.google_location_lat || updateData.google_location_lng) {
      updateData.google_location = updateData.google_location_lat && updateData.google_location_lng 
        ? `${updateData.google_location_lat},${updateData.google_location_lng}` 
        : '';
      delete updateData.google_location_lat;
      delete updateData.google_location_lng;
    }

    // Use MCP layer for update
    await mcp.update('clients', id, updateData);

    // Fetch the updated client
    const clientQuery = 'SELECT * FROM clients WHERE id = ?';
    const clientResult = await query(clientQuery, [id]);

    if (clientResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: clientResult[0]
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update client',
      error: error.message 
    });
  }
});

// Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid client ID. ID must be a number.' 
      });
    }
    
    // Use MCP layer for delete
    await mcp.delete('clients', id);

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete client',
      error: error.message 
    });
  }
});

module.exports = router;
