const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all price list items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, country = '', area = '' } = req.query;
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

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM price_list ${whereClause}`;
    const countResult = await query(countQuery, params);
    const totalCount = countResult[0]?.count || 0;

    // Get price list items
    const priceListQuery = `
      SELECT id, country, area, fees_usd as fee_usd, fees_lbp as fee_lbp, created_at, updated_at FROM price_list
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

// Get single price list item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const priceListQuery = 'SELECT id, country, area, fees_usd as fee_usd, fees_lbp as fee_lbp, created_at, updated_at FROM price_list WHERE id = ?';
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
      fee_lbp = 200000
    } = req.body;

    if (!country || !area) {
      return res.status(400).json({ 
        success: false, 
        message: 'Country and area are required' 
      });
    }

    const insertQuery = `
      INSERT INTO price_list (country, area, fees_usd, fees_lbp)
      VALUES (?, ?, ?, ?)
    `;

    const params = [country, area, fee_usd, fee_lbp];
    const result = await run(insertQuery, params);

    // Fetch the created item
    const priceListQuery = 'SELECT id, country, area, fees_usd as fee_usd, fees_lbp as fee_lbp, created_at, updated_at FROM price_list WHERE id = ?';
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
    const priceListQuery = 'SELECT id, country, area, fees_usd as fee_usd, fees_lbp as fee_lbp, created_at, updated_at FROM price_list WHERE id = ?';
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

// Delete price list item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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

