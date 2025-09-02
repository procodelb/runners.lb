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
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (search) {
      filterConditions.push(`(business_name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      filterConditions.push(`category = ?`);
      filterParams.push(category);
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

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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
      business_name,
      contact_person,
      phone,
      address,
      instagram,
      website,
      google_location_lat,
      google_location_lng,
      google_location,
      category
    } = req.body;

    if (!business_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Business name is required' 
      });
    }

    // Handle Google location - use provided google_location or combine lat/lng
    const finalGoogleLocation = google_location || (google_location_lat && google_location_lng 
      ? `${google_location_lat},${google_location_lng}` 
      : '');

    // Use MCP layer for client creation
    const clientData = {
      business_name,
      contact_person: contact_person || '',
      phone: phone || '',
      address: address || '',
      instagram: instagram || '',
      website: website || '',
      google_location: finalGoogleLocation,
      category: category || ''
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
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    // Handle Google location fields
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

// Search clients
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query: searchQuery } = req.params;
    
    const searchSql = `
      SELECT * FROM clients 
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

module.exports = router;
