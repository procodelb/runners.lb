const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all price list items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, country = '', area = '', search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];

    if (country) {
      whereClause = 'WHERE LOWER(country) LIKE LOWER(?)';
      params.push(`%${country}%`);
    }

    if (area && whereClause) {
      whereClause += ' AND LOWER(area) LIKE LOWER(?)';
      params.push(`%${area}%`);
    } else if (area) {
      whereClause = 'WHERE LOWER(area) LIKE LOWER(?)';
      params.push(`%${area}%`);
    }

    if (search) {
      if (whereClause) {
        whereClause += ' AND (LOWER(country) LIKE LOWER(?) OR LOWER(area) LIKE LOWER(?))';
        params.push(`%${search}%`, `%${search}%`);
      } else {
        whereClause = 'WHERE (LOWER(country) LIKE LOWER(?) OR LOWER(area) LIKE LOWER(?))';
        params.push(`%${search}%`, `%${search}%`);
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM price_list ${whereClause}`;
    const countResult = await query(countQuery, params);
    const totalCount = countResult[0]?.count || 0;

    // Get price list items
    const priceListQuery = `
      SELECT id, country, area, 
             COALESCE(NULLIF(TRIM(fees_usd::text), ''), '0')::numeric as fee_usd, 
             COALESCE(NULLIF(TRIM(fees_lbp::text), ''), '0')::numeric as fee_lbp, 
             COALESCE(NULLIF(TRIM(third_party_fee_usd::text), ''), '0')::numeric as third_party_fee_usd, 
             COALESCE(NULLIF(TRIM(third_party_fee_lbp::text), ''), '0')::numeric as third_party_fee_lbp,
             COALESCE(is_active, true) as is_active,
             created_at, updated_at 
      FROM price_list
      ${whereClause}
      ORDER BY country, area
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const priceListResult = await query(priceListQuery, params);

    res.json({
      success: true,
      data: priceListResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch price list',
      error: error.message 
    });
  }
});

// Search price list items for autocomplete - MUST come before /:id route
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q = '' } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchQuery = `
      SELECT id, country, area, 
             COALESCE(NULLIF(TRIM(fees_usd::text), ''), '0')::numeric as fee_usd, 
             COALESCE(NULLIF(TRIM(fees_lbp::text), ''), '0')::numeric as fee_lbp, 
             COALESCE(NULLIF(TRIM(third_party_fee_usd::text), ''), '0')::numeric as third_party_fee_usd, 
             COALESCE(NULLIF(TRIM(third_party_fee_lbp::text), ''), '0')::numeric as third_party_fee_lbp
      FROM price_list 
      WHERE (LOWER(country) LIKE LOWER(?) OR LOWER(area) LIKE LOWER(?))
      AND COALESCE(is_active, true) = true
      ORDER BY 
        CASE 
          WHEN LOWER(area) LIKE LOWER(?) THEN 1
          WHEN LOWER(country) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        country, area
      LIMIT 10
    `;
    
    const searchTerm = `%${q}%`;
    const result = await query(searchQuery, [searchTerm, searchTerm, searchTerm, searchTerm]);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error searching price list:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search price list',
      error: error.message 
    });
  }
});

// Get single price list item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number to prevent search parameter confusion
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid price list item ID. ID must be a number.' 
      });
    }
    
    const priceListQuery = 'SELECT id, country, area, fees_usd as fee_usd, fees_lbp as fee_lbp, COALESCE(is_active, true) as is_active, created_at, updated_at FROM price_list WHERE id = ?';
    const result = await query(priceListQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Price list item not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching price list item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch price list item',
      error: error.message 
    });
  }
});

// Create new price list item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      country,
      area,
      fee_usd = 0,
      fee_lbp = 0,
      third_party_fee_usd = 0,
      third_party_fee_lbp = 0,
      is_active = true
    } = req.body;

    if (!country || !area) {
      return res.status(400).json({ 
        success: false, 
        message: 'Country and area are required' 
      });
    }

    const insertQuery = `
      INSERT INTO price_list (country, area, fees_usd, fees_lbp, third_party_fee_usd, third_party_fee_lbp, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [country, area, fee_usd, fee_lbp, third_party_fee_usd, third_party_fee_lbp, is_active];
    const result = await run(insertQuery, params);

    // Fetch the created item
    const priceListQuery = `
      SELECT id, country, area, 
             COALESCE(fees_usd, 0) as fee_usd, 
             COALESCE(fees_lbp, 0) as fee_lbp, 
             COALESCE(third_party_fee_usd, 0) as third_party_fee_usd, 
             COALESCE(third_party_fee_lbp, 0) as third_party_fee_lbp,
             COALESCE(is_active, true) as is_active,
             created_at, updated_at 
      FROM price_list WHERE id = ?
    `;
    const priceListResult = await query(priceListQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Price list item created successfully',
      data: priceListResult[0]
    });
  } catch (error) {
    console.error('Error creating price list item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create price list item',
      error: error.message 
    });
  }
});

// Update price list item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid price list item ID. ID must be a number.' 
      });
    }
    
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateQuery = `UPDATE price_list SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    values.push(id);
    await run(updateQuery, values);

    // Fetch the updated item
    const priceListQuery = `
      SELECT id, country, area, 
             COALESCE(fees_usd, 0) as fee_usd, 
             COALESCE(fees_lbp, 0) as fee_lbp, 
             COALESCE(third_party_fee_usd, 0) as third_party_fee_usd, 
             COALESCE(third_party_fee_lbp, 0) as third_party_fee_lbp,
             is_active,
             created_at, updated_at 
      FROM price_list WHERE id = ?
    `;
    const priceListResult = await query(priceListQuery, [id]);

    if (priceListResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Price list item not found' 
      });
    }

    res.json({
      success: true,
      message: 'Price list item updated successfully',
      data: priceListResult[0]
    });
  } catch (error) {
    console.error('Error updating price list item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update price list item',
      error: error.message 
    });
  }
});

// Toggle price list item status
router.patch('/:id/toggle-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid price list item ID. ID must be a number.' 
      });
    }
    
    const { is_active } = req.body;

    const updateQuery = `UPDATE price_list SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await run(updateQuery, [is_active ? 1 : 0, id]);

    // Fetch the updated item
    const priceListQuery = `
      SELECT id, country, area, 
             COALESCE(fees_usd, 0) as fee_usd, 
             COALESCE(fees_lbp, 0) as fee_lbp, 
             COALESCE(third_party_fee_usd, 0) as third_party_fee_usd, 
             COALESCE(third_party_fee_lbp, 0) as third_party_fee_lbp,
             COALESCE(is_active, true) as is_active,
             created_at, updated_at 
      FROM price_list WHERE id = ?
    `;
    const priceListResult = await query(priceListQuery, [id]);

    if (priceListResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Price list item not found' 
      });
    }

    res.json({
      success: true,
      message: 'Price list item status updated successfully',
      data: priceListResult[0]
    });
  } catch (error) {
    console.error('Error toggling price list item status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update price list item status',
      error: error.message 
    });
  }
});

// Delete price list item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid price list item ID. ID must be a number.' 
      });
    }
    
    const deleteQuery = 'DELETE FROM price_list WHERE id = ?';
    const result = await run(deleteQuery, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Price list item not found' 
      });
    }

    res.json({
      success: true,
      message: 'Price list item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting price list item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete price list item',
      error: error.message 
    });
  }
});

module.exports = router;

