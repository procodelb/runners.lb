const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'delivery-prices-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload and process delivery prices file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      data: []
    };

    if (fileExt === '.csv') {
      results = await processCSVFile(filePath, req.user.id);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      results = await processExcelFile(filePath, req.user.id);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `File processed. ${results.successful} successful, ${results.failed} failed.`,
      data: results
    });

  } catch (error) {
    console.error('Error processing file:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process file',
      error: error.message
    });
  }
});

// Process CSV file
async function processCSVFile(filePath, userId) {
  return new Promise((resolve, reject) => {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      data: []
    };

    const stream = fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase()
      }))
      .on('data', async (row) => {
        results.processed++;
        
        try {
          // Map CSV columns to our database fields
          const priceData = {
            country: row.country || row.country_name || 'Lebanon',
            region: row.region || row.district || row.area,
            sub_region: row.sub_region || row.location_name_en || row.location_name_arabic || null,
            price_lbp: parseInt(row.price_lbp || row.lpb_delivery_fees || row.fees_lbp || 0),
            price_usd: parseFloat(row.price_usd || row.usd_delivery_fees || row.fees_usd || 0),
            is_active: true,
            created_by: userId
          };

          // Validate required fields
          if (!priceData.region) {
            throw new Error('Region is required');
          }

          // Clean up price values (remove commas, convert to numbers)
          if (typeof priceData.price_lbp === 'string') {
            priceData.price_lbp = parseInt(priceData.price_lbp.replace(/[,\s]/g, '')) || 0;
          }
          if (typeof priceData.price_usd === 'string') {
            priceData.price_usd = parseFloat(priceData.price_usd.replace(/[,\s$]/g, '')) || 0;
          }

          // Insert or update delivery price
          await mcp.create('delivery_prices', priceData);
          results.successful++;
          results.data.push(priceData);

        } catch (error) {
          results.failed++;
          results.errors.push({
            row: results.processed,
            data: row,
            error: error.message
          });
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Process Excel file (simplified - would need xlsx library in production)
async function processExcelFile(filePath, userId) {
  // For now, return an error suggesting CSV format
  // In production, you would use a library like 'xlsx' to parse Excel files
  throw new Error('Excel file processing not implemented. Please convert to CSV format.');
}

// Get import template
router.get('/template', authenticateToken, async (req, res) => {
  try {
    const template = [
      {
        country: 'Lebanon',
        region: 'Beirut',
        sub_region: 'Hamra',
        price_lbp: 200000,
        price_usd: 2.25
      },
      {
        country: 'Lebanon',
        region: 'El Koura',
        sub_region: 'Aaba',
        price_lbp: 200000,
        price_usd: 0.0
      },
      {
        country: 'Lebanon',
        region: 'Mount Lebanon',
        sub_region: null,
        price_lbp: 250000,
        price_usd: 2.81
      }
    ];

    // Generate CSV template
    const headers = ['country', 'region', 'sub_region', 'price_lbp', 'price_usd'];
    const csvRows = template.map(row => [
      row.country,
      row.region,
      row.sub_region || '',
      row.price_lbp,
      row.price_usd
    ]);

    const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=delivery_prices_template.csv');
    res.send(csv);

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
});

// Validate delivery prices data
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { prices } = req.body;

    if (!Array.isArray(prices)) {
      return res.status(400).json({
        success: false,
        message: 'Prices must be an array'
      });
    }

    const validationResults = {
      valid: 0,
      invalid: 0,
      errors: [],
      warnings: []
    };

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const errors = [];
      const warnings = [];

      // Required field validation
      if (!price.country) {
        errors.push('Country is required');
      }
      if (!price.region) {
        errors.push('Region is required');
      }

      // Price validation
      if (price.price_lbp !== undefined && (isNaN(price.price_lbp) || price.price_lbp < 0)) {
        errors.push('Price LBP must be a valid positive number');
      }
      if (price.price_usd !== undefined && (isNaN(price.price_usd) || price.price_usd < 0)) {
        errors.push('Price USD must be a valid positive number');
      }

      // Warning for zero prices
      if (price.price_lbp === 0 && price.price_usd === 0) {
        warnings.push('Both LBP and USD prices are zero');
      }

      // Check for duplicates
      const duplicate = prices.slice(0, i).find(p => 
        p.country === price.country && 
        p.region === price.region && 
        p.sub_region === price.sub_region
      );
      if (duplicate) {
        warnings.push('Duplicate entry found for same location');
      }

      if (errors.length > 0) {
        validationResults.invalid++;
        validationResults.errors.push({
          row: i + 1,
          data: price,
          errors: errors
        });
      } else {
        validationResults.valid++;
        if (warnings.length > 0) {
          validationResults.warnings.push({
            row: i + 1,
            data: price,
            warnings: warnings
          });
        }
      }
    }

    res.json({
      success: true,
      data: validationResults
    });

  } catch (error) {
    console.error('Error validating prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate prices',
      error: error.message
    });
  }
});

// Bulk update delivery prices
router.post('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { prices, update_mode = 'upsert' } = req.body; // upsert, insert_only, update_only

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prices array is required and must not be empty'
      });
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const price of prices) {
      try {
        results.processed++;

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

        if (update_mode === 'upsert') {
          // Check if record exists
          const existingQuery = `
            SELECT id FROM delivery_prices 
            WHERE country = ? AND region = ? AND sub_region IS NOT DISTINCT FROM ?
          `;
          const existing = await query(existingQuery, [priceData.country, priceData.region, priceData.sub_region]);

          if (existing.length > 0) {
            // Update existing
            await mcp.update('delivery_prices', existing[0].id, {
              price_lbp: priceData.price_lbp,
              price_usd: priceData.price_usd,
              is_active: priceData.is_active
            });
          } else {
            // Insert new
            await mcp.create('delivery_prices', priceData);
          }
        } else if (update_mode === 'insert_only') {
          await mcp.create('delivery_prices', priceData);
        } else if (update_mode === 'update_only') {
          const existingQuery = `
            SELECT id FROM delivery_prices 
            WHERE country = ? AND region = ? AND sub_region IS NOT DISTINCT FROM ?
          `;
          const existing = await query(existingQuery, [priceData.country, priceData.region, priceData.sub_region]);

          if (existing.length > 0) {
            await mcp.update('delivery_prices', existing[0].id, {
              price_lbp: priceData.price_lbp,
              price_usd: priceData.price_usd,
              is_active: priceData.is_active
            });
          } else {
            throw new Error('Record not found for update');
          }
        }

        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          row: results.processed,
          data: price,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk update completed. ${results.successful} successful, ${results.failed} failed.`,
      data: results
    });

  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update delivery prices',
      error: error.message
    });
  }
});

// Get import history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // This would require an import_history table in production
    // For now, return a simple response
    res.json({
      success: true,
      data: [],
      message: 'Import history feature not implemented yet'
    });

  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch import history',
      error: error.message
    });
  }
});

module.exports = router;
