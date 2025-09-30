const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const mcp = require('../mcp');
const { query } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Get clients accounting data
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, search } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (from_date) {
      whereClause += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      whereClause += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    if (search) {
      whereClause += ' AND (c.business_name LIKE ? OR c.contact_person LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Orders aggregates per client
    const clientsQuery = `
      WITH orders_agg AS (
        SELECT 
          o.brand_name,
          COUNT(o.id) AS orders_count,
          COALESCE(SUM(o.total_usd),0) AS orders_total_usd,
          COALESCE(SUM(o.total_lbp),0) AS orders_total_lbp,
          COALESCE(SUM(o.delivery_fee_usd),0) AS fees_total_usd,
          COALESCE(SUM(o.delivery_fee_lbp),0) AS fees_total_lbp
        FROM orders o
        ${whereClause}
        GROUP BY o.brand_name
      ),
      payments_agg AS (
        SELECT 
          c.business_name,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END),0) AS payments_total_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END),0) AS payments_total_lbp,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END),0) AS debits_total_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END),0) AS debits_total_lbp
        FROM clients c
        LEFT JOIN transactions t ON t.actor_type = 'client' AND t.actor_id = c.id
        GROUP BY c.business_name
      )
      SELECT 
        c.id,
        c.business_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        COALESCE(oa.orders_count,0) AS orders_count,
        COALESCE(oa.orders_total_usd,0) AS orders_total_usd,
        COALESCE(oa.orders_total_lbp,0) AS orders_total_lbp,
        COALESCE(oa.fees_total_usd,0) AS fees_total_usd,
        COALESCE(oa.fees_total_lbp,0) AS fees_total_lbp,
        COALESCE(pa.payments_total_usd,0) AS payments_total_usd,
        COALESCE(pa.payments_total_lbp,0) AS payments_total_lbp,
        COALESCE(pa.debits_total_usd,0) AS debits_total_usd,
        COALESCE(pa.debits_total_lbp,0) AS debits_total_lbp,
        0::numeric AS old_balance_usd,
        0::bigint AS old_balance_lbp,
        (COALESCE(oa.orders_total_usd,0) - COALESCE(pa.payments_total_usd,0) + COALESCE(pa.debits_total_usd,0)) AS new_balance_usd,
        (COALESCE(oa.orders_total_lbp,0) - COALESCE(pa.payments_total_lbp,0) + COALESCE(pa.debits_total_lbp,0)) AS new_balance_lbp
      FROM clients c
      LEFT JOIN orders_agg oa ON oa.brand_name = c.business_name
      LEFT JOIN payments_agg pa ON pa.business_name = c.business_name
      ORDER BY c.business_name
    `;
    const clients = await query(clientsQuery, params);
    
    res.json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching clients accounting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients accounting data',
      error: error.message
    });
  }
});

// Get client details
router.get('/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;
    
    // Get client info
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Get client orders
    let ordersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        tp.name as third_party_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN third_parties tp ON o.third_party_id = tp.id
      WHERE o.brand_name = ?
    `;
    
    const params = [client.business_name];
    
    if (from_date) {
      ordersQuery += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      ordersQuery += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    ordersQuery += ' ORDER BY o.created_at DESC';
    
    const orders = await query(ordersQuery, params);
    
    // Totals and statement
    const totals = orders.reduce((acc, order) => {
      acc.orders_total_usd += parseFloat(order.total_usd || 0);
      acc.orders_total_lbp += parseInt(order.total_lbp || 0);
      acc.fees_total_usd += parseFloat(order.delivery_fee_usd || 0);
      acc.fees_total_lbp += parseInt(order.delivery_fee_lbp || 0);
      return acc;
    }, { orders_total_usd: 0, orders_total_lbp: 0, fees_total_usd: 0, fees_total_lbp: 0 });

    // Payments and adjustments from transactions
    const txWhere = ['t.actor_type = ?','t.actor_id = ?'];
    const txParams = ['client', id];
    if (from_date) { txWhere.push('t.created_at >= ?'); txParams.push(from_date); }
    if (to_date) { txWhere.push('t.created_at <= ?'); txParams.push(to_date + ' 23:59:59'); }
    const txSql = `
      SELECT t.* FROM transactions t WHERE ${txWhere.join(' AND ')} ORDER BY t.created_at ASC
    `;
    const transactions = await query(txSql, txParams);
    const payments_total_usd = transactions.reduce((s,t)=> s + (t.direction==='credit'? parseFloat(t.amount_usd||0):0), 0);
    const payments_total_lbp = transactions.reduce((s,t)=> s + (t.direction==='credit'? parseInt(t.amount_lbp||0):0), 0);
    const debits_total_usd = transactions.reduce((s,t)=> s + (t.direction==='debit'? parseFloat(t.amount_usd||0):0), 0);
    const debits_total_lbp = transactions.reduce((s,t)=> s + (t.direction==='debit'? parseInt(t.amount_lbp||0):0), 0);

    const old_balance_usd = 0;
    const old_balance_lbp = 0;
    const new_balance_usd = old_balance_usd + totals.orders_total_usd - payments_total_usd + debits_total_usd;
    const new_balance_lbp = old_balance_lbp + totals.orders_total_lbp - payments_total_lbp + debits_total_lbp;
    
    res.json({
      success: true,
      data: {
        client,
        orders,
        transactions,
        orders_total_usd: totals.orders_total_usd,
        orders_total_lbp: totals.orders_total_lbp,
        fees_total_usd: totals.fees_total_usd,
        fees_total_lbp: totals.fees_total_lbp,
        payments_total_usd,
        payments_total_lbp,
        old_balance_usd,
        old_balance_lbp,
        new_balance_usd,
        new_balance_lbp
      }
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client details',
      error: error.message
    });
  }
});

// Get drivers accounting data
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, search } = req.query;
    
    let whereClause = 'WHERE d.active = true';
    const params = [];
    
    if (from_date) {
      whereClause += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      whereClause += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    if (search) {
      whereClause += ' AND (d.full_name LIKE ? OR d.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const driversQuery = `
      SELECT 
        d.id,
        d.full_name,
        d.phone,
        d.address,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_lbp,
        COUNT(o.id) as delivered_orders,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.driver_fee_usd ELSE 0 END), 0) as delivered_fee_usd,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.driver_fee_lbp ELSE 0 END), 0) as delivered_fee_lbp
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id ${whereClause.replace('WHERE d.active = true', '')}
      GROUP BY d.id, d.full_name, d.phone, d.address
      ORDER BY d.full_name
    `;
    
    const drivers = await query(driversQuery, params);
    
    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers accounting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers accounting data',
      error: error.message
    });
  }
});

// Get driver details
router.get('/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;
    
    // Get driver info
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Get driver operations
    let operationsQuery = `
      SELECT 
        o.*,
        c.business_name as client_name,
        tp.name as third_party_name
      FROM orders o
      LEFT JOIN clients c ON o.brand_name = c.business_name
      LEFT JOIN third_parties tp ON o.third_party_id = tp.id
      WHERE o.driver_id = ?
    `;
    
    const params = [id];
    
    if (from_date) {
      operationsQuery += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      operationsQuery += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    operationsQuery += ' ORDER BY o.created_at DESC';
    
    const operations = await query(operationsQuery, params);
    
    // Calculate totals
    const totals = operations.reduce((acc, operation) => {
      acc.total_revenue_usd += parseFloat(operation.driver_fee_usd || 0);
      acc.total_revenue_lbp += parseInt(operation.driver_fee_lbp || 0);
      acc.delivered_orders += operation.status === 'delivered' ? 1 : 0;
      acc.total_orders += 1;
      return acc;
    }, {
      total_revenue_usd: 0,
      total_revenue_lbp: 0,
      delivered_orders: 0,
      total_orders: 0
    });
    
    res.json({
      success: true,
      data: {
        driver,
        orders: operations,
        ...totals
      }
    });
  } catch (error) {
    console.error('Error fetching driver details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver details',
      error: error.message
    });
  }
});

// Get third parties accounting data
router.get('/thirdparty', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, search } = req.query;
    
    let whereClause = 'WHERE tp.active = true';
    const params = [];
    
    if (from_date) {
      whereClause += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      whereClause += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    if (search) {
      whereClause += ' AND (tp.name LIKE ? OR tp.contact_person LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const thirdPartiesQuery = `
      SELECT 
        tp.id,
        tp.name,
        tp.contact_person,
        tp.phone,
        tp.email,
        tp.commission_rate,
        COALESCE(SUM(o.third_party_fee_usd), 0) as total_usd,
        COALESCE(SUM(o.third_party_fee_lbp), 0) as total_lbp,
        COUNT(o.id) as delivered_orders,
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        COALESCE(MAX(o.created_at), CURRENT_TIMESTAMP) as last_order_at
      FROM third_parties tp
      LEFT JOIN orders o ON tp.id = o.third_party_id ${whereClause.replace('WHERE tp.active = true', '')}
      GROUP BY tp.id, tp.name, tp.contact_person, tp.phone, tp.email, tp.commission_rate
      ORDER BY tp.name
    `;
    
    const thirdParties = await query(thirdPartiesQuery, params);
    
    res.json({
      success: true,
      data: thirdParties
    });
  } catch (error) {
    console.error('Error fetching third parties accounting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch third parties accounting data',
      error: error.message,
      data: []
    });
  }
});

// Get third party details
router.get('/thirdparty/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { from_date, to_date } = req.query;
    
    // Get third party info
    const [thirdParty] = await query('SELECT * FROM third_parties WHERE name = ?', [name]);
    if (!thirdParty) {
      return res.status(404).json({
        success: false,
        message: 'Third party not found'
      });
    }
    
    // Get third party orders
    let ordersQuery = `
      SELECT 
        o.*,
        c.business_name as client_name,
        d.full_name as driver_name
      FROM orders o
      LEFT JOIN clients c ON o.brand_name = c.business_name
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.third_party_id = ?
    `;
    
    const params = [thirdParty.id];
    
    if (from_date) {
      ordersQuery += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      ordersQuery += ' AND o.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    ordersQuery += ' ORDER BY o.created_at DESC';
    
    const orders = await query(ordersQuery, params);
    
    // Calculate totals
    const totals = orders.reduce((acc, order) => {
      acc.total_revenue_usd += parseFloat(order.total_usd || 0);
      acc.total_revenue_lbp += parseInt(order.total_lbp || 0);
      acc.third_party_fee_usd += parseFloat(order.third_party_fee_usd || 0);
      acc.third_party_fee_lbp += parseInt(order.third_party_fee_lbp || 0);
      acc.company_profit_usd += parseFloat(order.total_usd || 0) - parseFloat(order.third_party_fee_usd || 0) - parseFloat(order.driver_fee_usd || 0);
      acc.company_profit_lbp += parseInt(order.total_lbp || 0) - parseInt(order.third_party_fee_lbp || 0) - parseInt(order.driver_fee_lbp || 0);
      return acc;
    }, {
      total_revenue_usd: 0,
      total_revenue_lbp: 0,
      third_party_fee_usd: 0,
      third_party_fee_lbp: 0,
      company_profit_usd: 0,
      company_profit_lbp: 0
    });
    
    res.json({
      success: true,
      data: {
        third_party: thirdParty,
        orders,
        ...totals
      }
    });
  } catch (error) {
    console.error('Error fetching third party details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch third party details',
      error: error.message
    });
  }
});

// Cashout endpoints
router.post('/clients/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd, amount_lbp, description } = req.body;
    
    // Get client info
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Create cashout transaction
    const transaction = await mcp.create('transactions', {
      tx_type: 'client_cashout',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      actor_type: 'client',
      actor_id: id,
      description: description || `Cashout for client ${client.business_name}`,
      created_by: req.user.id
    });
    
    // Log to order history
    await mcp.create('order_history', {
      order_id: null,
      action: 'cashout',
      new_values: {
        client_id: id,
        amount_usd,
        amount_lbp,
        description
      },
      changed_by: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Cashout completed successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error processing client cashout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process cashout',
      error: error.message
    });
  }
});

router.post('/drivers/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd, amount_lbp, description } = req.body;
    
    // Get driver info
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Create cashout transaction
    const transaction = await mcp.create('transactions', {
      tx_type: 'driver_cashout',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      actor_type: 'driver',
      actor_id: id,
      description: description || `Cashout for driver ${driver.full_name}`,
      created_by: req.user.id
    });
    
    // Log to order history
    await mcp.create('order_history', {
      order_id: null,
      action: 'cashout',
      new_values: {
        driver_id: id,
        amount_usd,
        amount_lbp,
        description
      },
      changed_by: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Cashout completed successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error processing driver cashout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process cashout',
      error: error.message
    });
  }
});

router.post('/thirdparty/:name/cashout', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { amount_usd, amount_lbp, description } = req.body;
    
    // Get third party info
    const [thirdParty] = await query('SELECT * FROM third_parties WHERE name = ?', [name]);
    if (!thirdParty) {
      return res.status(404).json({
        success: false,
        message: 'Third party not found'
      });
    }
    
    // Create cashout transaction
    const transaction = await mcp.create('transactions', {
      tx_type: 'third_party_cashout',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      actor_type: 'third_party',
      actor_id: thirdParty.id,
      description: description || `Cashout for third party ${thirdParty.name}`,
      created_by: req.user.id
    });
    
    // Log to order history
    await mcp.create('order_history', {
      order_id: null,
      action: 'cashout',
      new_values: {
        third_party_id: thirdParty.id,
        amount_usd,
        amount_lbp,
        description
      },
      changed_by: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Cashout completed successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error processing third party cashout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process cashout',
      error: error.message
    });
  }
});

// Export endpoints
router.get('/export/csv', authenticateToken, async (req, res) => {
  try {
    const { type, entity_id, from_date, to_date } = req.query;
    
    let data = [];
    let filename = '';
    
    switch (type) {
      case 'clients':
        const clientsRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/clients?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await clientsRes.json();
        filename = 'clients-accounting.csv';
        break;
        
      case 'drivers':
        const driversRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/drivers?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await driversRes.json();
        filename = 'drivers-accounting.csv';
        break;
        
      case 'third_parties':
        const thirdPartiesRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/thirdparty?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await thirdPartiesRes.json();
        filename = 'third-parties-accounting.csv';
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }
    
    // Convert to CSV
    const csvData = data.data || [];
    if (csvData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data to export'
      });
    }
    
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export CSV',
      error: error.message
    });
  }
});

router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const { type, entity_id, from_date, to_date } = req.query;
    
    let data = [];
    let filename = '';
    
    switch (type) {
      case 'clients':
        const clientsRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/clients?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await clientsRes.json();
        filename = 'clients-accounting.xlsx';
        break;
        
      case 'drivers':
        const driversRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/drivers?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await driversRes.json();
        filename = 'drivers-accounting.xlsx';
        break;
        
      case 'third_parties':
        const thirdPartiesRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/thirdparty?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await thirdPartiesRes.json();
        filename = 'third-parties-accounting.xlsx';
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Accounting Data');
    
    const csvData = data.data || [];
    if (csvData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data to export'
      });
    }
    
    // Add headers
    const headers = Object.keys(csvData[0]);
    worksheet.addRow(headers);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data
    csvData.forEach(row => {
      worksheet.addRow(headers.map(header => row[header] || ''));
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export Excel file',
      error: error.message
    });
  }
});

router.get('/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { type, entity_id, from_date, to_date } = req.query;
    
    let data = [];
    let title = '';
    
    switch (type) {
      case 'clients':
        const clientsRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/clients?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await clientsRes.json();
        title = 'Clients Accounting Report';
        break;
        
      case 'drivers':
        const driversRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/drivers?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await driversRes.json();
        title = 'Drivers Accounting Report';
        break;
        
      case 'third_parties':
        const thirdPartiesRes = await fetch(`${req.protocol}://${req.get('host')}/api/accounting/thirdparty?from_date=${from_date}&to_date=${to_date}`, {
          headers: { Authorization: req.headers.authorization }
        });
        data = await thirdPartiesRes.json();
        title = 'Third Parties Accounting Report';
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }
    
    // Create PDF
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-accounting-${new Date().toISOString().slice(0, 10)}.pdf"`);
    
    doc.pipe(res);
    
    // Add title
    doc.fontSize(20).text(title, 50, 50);
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80);
    
    if (from_date && to_date) {
      doc.text(`Period: ${from_date} to ${to_date}`, 50, 100);
    }
    
    // Add data table
    const csvData = data.data || [];
    if (csvData.length === 0) {
      doc.text('No data available', 50, 130);
    } else {
      let y = 130;
      const headers = Object.keys(csvData[0]);
      
      // Add headers
      doc.fontSize(10).font('Helvetica-Bold');
      headers.forEach((header, index) => {
        doc.text(header, 50 + (index * 100), y);
      });
      
      y += 20;
      
      // Add data rows
      doc.font('Helvetica');
      csvData.slice(0, 20).forEach(row => { // Limit to 20 rows for PDF
        headers.forEach((header, index) => {
          doc.text(String(row[header] || ''), 50 + (index * 100), y);
        });
        y += 15;
        
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });
    }
    
    doc.end();
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export PDF',
      error: error.message
    });
  }
});

module.exports = router;
