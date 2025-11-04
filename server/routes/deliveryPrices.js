const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all delivery prices with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      country = '', 
      region = '',
      search = '',
      is_active = '',
      sortBy = 'country, region, sub_region',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (country) {
      filterConditions.push(`country = ?`);
      filterParams.push(country);
    }

    if (region) {
      filterConditions.push(`region = ?`);
      filterParams.push(region);
    }

    if (search) {
      filterConditions.push(`(country LIKE ? OR region LIKE ? OR sub_region LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (is_active !== '') {
      filterConditions.push(`is_active = ?`);
      filterParams.push(is_active === 'true' ? 1 : 0);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM delivery_prices ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get delivery prices with pagination
    const pricesQuery = `
      SELECT 
        dp.*,
        u.full_name as created_by_name
      FROM delivery_prices dp
      LEFT JOIN users u ON dp.created_by = u.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const pricesResult = await query(pricesQuery, filterParams);

    res.json({
      success: true,
      data: pricesResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching delivery prices:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery prices',
      error: error.message 
    });
  }
});

// Get single delivery price
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number to prevent search parameter confusion
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid delivery price ID. ID must be a number.' 
      });
    }
    
    const priceQuery = `
      SELECT 
        dp.*,
        u.full_name as created_by_name
      FROM delivery_prices dp
      LEFT JOIN users u ON dp.created_by = u.id
      WHERE dp.id = ?
    `;
    
    const result = await query(priceQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Delivery price not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching delivery price:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery price',
      error: error.message 
    });
  }
});

// Create new delivery price
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      country = 'Lebanon',
      region,
      sub_region,
      price_lbp = 0,
      price_usd = 0,
      is_active = true
    } = req.body;

    if (!region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Region is required' 
      });
    }

    // Use MCP layer for creation
    const priceData = {
      country,
      region,
      sub_region: sub_region || null,
      price_lbp: parseInt(price_lbp) || 0,
      price_usd: parseFloat(price_usd) || 0,
      is_active: is_active ? 1 : 0,
      created_by: req.user.id
    };

    const result = await mcp.create('delivery_prices', priceData);

    // Fetch the created price
    const priceQuery = `
      SELECT 
        dp.*,
        u.full_name as created_by_name
      FROM delivery_prices dp
      LEFT JOIN users u ON dp.created_by = u.id
      WHERE dp.id = ?
    `;
    
    const priceResult = await query(priceQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Delivery price created successfully',
      data: priceResult[0]
    });
  } catch (error) {
    console.error('Error creating delivery price:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create delivery price',
      error: error.message 
    });
  }
});

// Update delivery price
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid delivery price ID. ID must be a number.' 
      });
    }
    
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    // Convert boolean fields
    if (updateData.is_active !== undefined) {
      updateData.is_active = updateData.is_active ? 1 : 0;
    }

    // Convert numeric fields
    if (updateData.price_lbp !== undefined) {
      updateData.price_lbp = parseInt(updateData.price_lbp) || 0;
    }
    if (updateData.price_usd !== undefined) {
      updateData.price_usd = parseFloat(updateData.price_usd) || 0;
    }

    // Use MCP layer for update
    await mcp.update('delivery_prices', id, updateData);

    // Fetch the updated price
    const priceQuery = `
      SELECT 
        dp.*,
        u.full_name as created_by_name
      FROM delivery_prices dp
      LEFT JOIN users u ON dp.created_by = u.id
      WHERE dp.id = ?
    `;
    
    const priceResult = await query(priceQuery, [id]);

    if (priceResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Delivery price not found' 
      });
    }

    res.json({
      success: true,
      message: 'Delivery price updated successfully',
      data: priceResult[0]
    });
  } catch (error) {
    console.error('Error updating delivery price:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update delivery price',
      error: error.message 
    });
  }
});

// Delete delivery price
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid delivery price ID. ID must be a number.' 
      });
    }
    
    // Check if price is being used in orders
    const usageQuery = 'SELECT COUNT(*) as count FROM orders WHERE delivery_price_id = ?';
    const usageResult = await query(usageQuery, [id]);
    const usageCount = usageResult[0]?.count || 0;

    if (usageCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete delivery price. It is being used by ${usageCount} order(s). Consider deactivating instead.` 
      });
    }
    
    // Use MCP layer for delete
    await mcp.delete('delivery_prices', id);

    res.json({
      success: true,
      message: 'Delivery price deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting delivery price:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete delivery price',
      error: error.message 
    });
  }
});

// Get delivery price by location
router.get('/lookup/location', authenticateToken, async (req, res) => {
  try {
    const { country = 'Lebanon', region, sub_region } = req.query;

    if (!region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Region is required' 
      });
    }

    // Try to find exact match first (with sub_region)
    let priceQuery = `
      SELECT * FROM delivery_prices 
      WHERE country = ? AND region = ? AND is_active = 1
    `;
    let params = [country, region];

    if (sub_region) {
      priceQuery += ` AND sub_region = ?`;
      params.push(sub_region);
    } else {
      priceQuery += ` AND sub_region IS NULL`;
    }

    priceQuery += ` ORDER BY created_at DESC LIMIT 1`;

    let result = await query(priceQuery, params);

    // If no exact match and sub_region was provided, try without sub_region
    if (result.length === 0 && sub_region) {
      priceQuery = `
        SELECT * FROM delivery_prices 
        WHERE country = ? AND region = ? AND sub_region IS NULL AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
      `;
      result = await query(priceQuery, [country, region]);
    }

    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No delivery price found for the specified location' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error looking up delivery price:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to lookup delivery price',
      error: error.message 
    });
  }
});

// Bulk import delivery prices from CSV/Excel data
router.post('/bulk-import', authenticateToken, async (req, res) => {
  try {
    const { prices } = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prices array is required and must not be empty' 
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      try {
        const priceData = {
          country: price.country || 'Lebanon',
          region: price.region,
          sub_region: price.sub_region || null,
          price_lbp: parseInt(price.price_lbp) || 0,
          price_usd: parseFloat(price.price_usd) || 0,
          is_active: price.is_active !== false,
          created_by: req.user.id
        };

        if (!priceData.region) {
          throw new Error('Region is required');
        }

        await mcp.create('delivery_prices', priceData);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          data: price,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed. ${results.success} successful, ${results.failed} failed.`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk import delivery prices',
      error: error.message 
    });
  }
});

// Get countries and regions for dropdowns
router.get('/meta/locations', authenticateToken, async (req, res) => {
  try {
    const countriesQuery = `
      SELECT DISTINCT country 
      FROM delivery_prices 
      WHERE is_active = 1 
      ORDER BY country
    `;
    const countries = await query(countriesQuery);

    const regionsQuery = `
      SELECT DISTINCT country, region 
      FROM delivery_prices 
      WHERE is_active = 1 
      ORDER BY country, region
    `;
    const regions = await query(regionsQuery);

    const subRegionsQuery = `
      SELECT DISTINCT country, region, sub_region 
      FROM delivery_prices 
      WHERE is_active = 1 AND sub_region IS NOT NULL 
      ORDER BY country, region, sub_region
    `;
    const subRegions = await query(subRegionsQuery);

    res.json({
      success: true,
      data: {
        countries: countries.map(c => c.country),
        regions: regions,
        sub_regions: subRegions
      }
    });
  } catch (error) {
    console.error('Error fetching location metadata:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch location metadata',
      error: error.message 
    });
  }
});

// Export delivery prices as CSV
router.get('/export/csv', authenticateToken, async (req, res) => {
  try {
    const { country = '', region = '', is_active = '' } = req.query;
    
    let whereClause = '';
    let params = [];

    if (country) {
      whereClause += ' AND country = ?';
      params.push(country);
    }

    if (region) {
      whereClause += ' AND region = ?';
      params.push(region);
    }

    if (is_active !== '') {
      whereClause += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    const pricesQuery = `
      SELECT 
        country, region, sub_region, price_lbp, price_usd, is_active,
        created_at, updated_at
      FROM delivery_prices 
      WHERE 1=1 ${whereClause}
      ORDER BY country, region, sub_region
    `;

    const prices = await query(pricesQuery, params);

    // Build CSV
    const headers = [
      'Country', 'Region', 'Sub Region', 'Price LBP', 'Price USD', 'Active', 'Created At', 'Updated At'
    ];

    const csvRows = prices.map(price => [
      price.country || '',
      price.region || '',
      price.sub_region || '',
      price.price_lbp || 0,
      price.price_usd || 0,
      price.is_active ? 'Yes' : 'No',
      new Date(price.created_at).toISOString().split('T')[0],
      new Date(price.updated_at).toISOString().split('T')[0]
    ]);

    const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=delivery_prices_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting delivery prices CSV:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export delivery prices CSV',
      error: error.message 
    });
  }
});

module.exports = router;
