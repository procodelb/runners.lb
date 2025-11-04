const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, run, getExchangeRate, usdToLbp, lbpToUsd, getPool, currentDatabase } = require('../config/database');
const { processClientCashout, processDriverCashout } = require('../utils/cashboxAtomicOperations');

// Get accounting overview data
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { fromDate, toDate, accountType, accountId } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }

    // Get orders with client and customer info
    const orders = await query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        o.type as order_type,
        o.deliver_method as delivery_method,
        o.status as order_status,
        o.payment_status,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.third_party_fee_usd,
        o.third_party_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.total_usd as total_order_value_usd,
        o.total_lbp as total_order_value_lbp,
        o.exchange_rate,
        o.created_at as date,
        o.notes,
        c.id as client_id,
        c.client_type,
        c.business_name as client_name,
        c.business_name,
        o.customer_name,
        o.customer_phone,
        o.customer_address as customer_location,
        d.full_name as driver_name,
        o.third_party_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching accounting overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get clients accounting data
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const { fromDate, toDate, clientId, statusFilter } = req.query;
    
    // Use LEFT JOIN with clients table to get all orders with client info
    // Exclude orders that have been cashed out (moved to history)
    let whereClause = 'WHERE (o.moved_to_history IS NULL OR o.moved_to_history = false)';
    const params = [];
    
    // Filter by status only if explicitly requested
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'delivered') {
        whereClause += ' AND o.status = ?';
        params.push('delivered');
      } else if (statusFilter === 'prepaid') {
        // Prepaid orders: either have cashbox_applied_on_create = true OR 
        // have payment_status = 'prepaid'/'paid' with type = 'ecommerce'/'instant'
        // This ensures we only show orders that actually had cash deducted on creation
        whereClause += ' AND (o.cashbox_applied_on_create = true OR ' +
                       '(o.payment_status IN (?, ?) AND o.type IN (?, ?)))';
        params.push('prepaid', 'paid', 'ecommerce', 'instant');
      }
    }
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }

    if (clientId) {
      // Check if clientId is a number (client ID) or string (brand name)
      const isNumeric = !isNaN(parseInt(clientId));
      if (isNumeric) {
        // If numeric, it's a client ID
        whereClause += ' AND o.client_id = ?';
        params.push(parseInt(clientId));
      } else {
        // If string, it's a brand name
        whereClause += ' AND o.brand_name = ?';
        params.push(clientId);
      }
    }

    const orders = await query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        COALESCE(c.business_name, o.brand_name, 'Unknown Client') as client_name,
        o.customer_name,
        o.customer_phone,
        o.customer_address as customer_location,
        o.type as order_type,
        o.deliver_method as delivery_method,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.total_usd as total_usd,
        o.total_lbp as total_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.third_party_fee_usd,
        o.third_party_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.total_usd as total_order_value_usd,
        o.total_lbp as total_order_value_lbp,
        o.payment_status,
        o.status as order_status,
        o.created_at as date,
        o.notes,
        o.accounting_cashed,
        o.moved_to_history,
        c.id as actual_client_id,
        o.brand_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);

    // Calculate summary for each client
    // Track ecommerce and instant orders separately for balance calculation
    const clientSummaries = {};
    orders.forEach(order => {
      const clientName = order.client_name;
      const orderType = String(order.order_type || '').toLowerCase().trim();
      const isEcommerce = orderType === 'ecommerce';
      const isInstant = orderType === 'instant';
      
      if (!clientSummaries[clientName]) {
        clientSummaries[clientName] = {
          clientName: clientName,
          clientId: clientName, // Use brand_name as ID for now
          ordersSumUsd: 0,
          ordersSumLbp: 0,
          deliveryFeesUsd: 0,
          deliveryFeesLbp: 0,
          thirdPartyFeesUsd: 0,
          thirdPartyFeesLbp: 0,
          driverFeesUsd: 0,
          driverFeesLbp: 0,
          paymentsReceivedUsd: 0,
          paymentsReceivedLbp: 0,
          oldBalanceUsd: 0,
          oldBalanceLbp: 0,
          newBalanceUsd: 0,
          newBalanceLbp: 0,
          totalValueUsd: 0,
          totalValueLbp: 0,
          orderCount: 0,
          // Track ecommerce and instant orders separately
          ecommerceOrdersSumUsd: 0,
          ecommerceOrdersSumLbp: 0,
          ecommerceFeesUsd: 0,
          ecommerceFeesLbp: 0,
          instantOrdersSumUsd: 0,
          instantOrdersSumLbp: 0,
          instantFeesUsd: 0,
          instantFeesLbp: 0
        };
      }

      const summary = clientSummaries[clientName];
      const orderPriceUsd = Number(order.price_usd || 0);
      const orderPriceLbp = Number(order.price_lbp || 0);
      const deliveryFeeUsd = Number(order.delivery_fee_usd || 0);
      const deliveryFeeLbp = Number(order.delivery_fee_lbp || 0);
      
      summary.ordersSumUsd += orderPriceUsd;
      summary.ordersSumLbp += orderPriceLbp;
      summary.deliveryFeesUsd += deliveryFeeUsd;
      summary.deliveryFeesLbp += deliveryFeeLbp;
      summary.thirdPartyFeesUsd += Number(order.third_party_fee_usd || 0);
      summary.thirdPartyFeesLbp += Number(order.third_party_fee_lbp || 0);
      summary.driverFeesUsd += Number(order.driver_fee_usd || 0);
      summary.driverFeesLbp += Number(order.driver_fee_lbp || 0);
      summary.orderCount += 1;
      
      // Track ecommerce and instant separately
      if (isEcommerce) {
        summary.ecommerceOrdersSumUsd += orderPriceUsd;
        summary.ecommerceOrdersSumLbp += orderPriceLbp;
        summary.ecommerceFeesUsd += deliveryFeeUsd;
        summary.ecommerceFeesLbp += deliveryFeeLbp;
      } else if (isInstant) {
        summary.instantOrdersSumUsd += orderPriceUsd;
        summary.instantOrdersSumLbp += orderPriceLbp;
        summary.instantFeesUsd += deliveryFeeUsd;
        summary.instantFeesLbp += deliveryFeeLbp;
      }
    });

    // Calculate total values and new balance based on order types
    for (const clientName in clientSummaries) {
      const summary = clientSummaries[clientName];
      
      // Calculate total value (orders sum + delivery fees for e-commerce - these are charges TO the client)
      summary.totalValueUsd = summary.ordersSumUsd + summary.deliveryFeesUsd;
      summary.totalValueLbp = summary.ordersSumLbp + summary.deliveryFeesLbp;

      // Calculate new balance based on order types:
      // - Ecommerce orders: new balance = Orders Sum minus Fees
      // - Instant orders: new balance = Orders Sum plus Fees
      // - Other orders: use total value
      const ecommerceBalanceUsd = summary.ecommerceOrdersSumUsd - summary.ecommerceFeesUsd;
      const ecommerceBalanceLbp = summary.ecommerceOrdersSumLbp - summary.ecommerceFeesLbp;
      const instantBalanceUsd = summary.instantOrdersSumUsd + summary.instantFeesUsd;
      const instantBalanceLbp = summary.instantOrdersSumLbp + summary.instantFeesLbp;
      
      // Calculate balance for other order types (non-ecommerce, non-instant)
      const otherOrdersSumUsd = summary.ordersSumUsd - summary.ecommerceOrdersSumUsd - summary.instantOrdersSumUsd;
      const otherOrdersSumLbp = summary.ordersSumLbp - summary.ecommerceOrdersSumLbp - summary.instantOrdersSumLbp;
      const otherFeesUsd = summary.deliveryFeesUsd - summary.ecommerceFeesUsd - summary.instantFeesUsd;
      const otherFeesLbp = summary.deliveryFeesLbp - summary.ecommerceFeesLbp - summary.instantFeesLbp;
      const otherBalanceUsd = otherOrdersSumUsd + otherFeesUsd;
      const otherBalanceLbp = otherOrdersSumLbp + otherFeesLbp;
      
      // Total new balance = ecommerce balance + instant balance + other balance
      summary.newBalanceUsd = ecommerceBalanceUsd + instantBalanceUsd + otherBalanceUsd;
      summary.newBalanceLbp = ecommerceBalanceLbp + instantBalanceLbp + otherBalanceLbp;
    }

    res.json({ 
      success: true, 
      data: orders,
      summaries: Object.values(clientSummaries),
      totalOrders: orders.length,
      totalClients: Object.keys(clientSummaries).length
    });
  } catch (error) {
    console.error('Error fetching clients accounting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get drivers accounting data
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    // Ensure old_balance columns exist in drivers table
    try {
      await run(`
        ALTER TABLE drivers 
        ADD COLUMN IF NOT EXISTS old_balance_usd NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS old_balance_lbp BIGINT DEFAULT 0
      `);
    } catch (schemaError) {
      // Columns might already exist, ignore error
      console.log('Schema check for drivers balance columns:', schemaError.message);
    }
    
    const { fromDate, toDate, driverId, statusFilter } = req.query;
    
    // Validate and sanitize driverId early
    if (driverId !== undefined && driverId !== null && driverId !== 'undefined' && driverId !== 'null' && driverId !== '') {
      const parsedDriverId = parseInt(driverId);
      if (isNaN(parsedDriverId) || parsedDriverId <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid driverId parameter. Must be a positive integer.',
          data: [],
          summaries: []
        });
      }
    }
    
    // Show orders with drivers that have status 'assigned', 'delivered', or 'completed'
    // Orders enter driver account when assigned and remain until cashout
    // Exclude orders that have been moved to history
    // Don't filter by accounting_cashed to show all driver accounts (they might be cashed for client but not driver)
    const dbType = currentDatabase();
    let statusCondition = '';
    if (dbType === 'postgresql') {
      // PostgreSQL: Show assigned, delivered, or completed orders (driver delivered this order)
      statusCondition = "AND LOWER(o.status) IN ('assigned', 'delivered', 'completed')";
    } else {
      // MySQL/SQLite: use LOWER for case-insensitive comparison
      statusCondition = "AND LOWER(o.status) IN ('assigned', 'delivered', 'completed')";
    }
    
    let whereClause = `WHERE o.driver_id IS NOT NULL ${statusCondition} AND (o.moved_to_history IS NULL OR o.moved_to_history = false)`;
    const params = [];
    
    // Additional status filter if explicitly requested (for further refinement)
    // Note: We already filter for 'assigned' status by default, so additional filters are for extra refinements
    if (statusFilter && statusFilter !== 'all' && statusFilter !== 'assigned') {
      if (statusFilter === 'prepaid') {
        whereClause += ' AND (o.cashbox_applied_on_create = true OR (o.payment_status IN (?, ?) AND o.type IN (?, ?)))';
        params.push('prepaid', 'paid', 'ecommerce', 'instant');
      }
    }
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }

    // Filter by driverId only if it's valid
    if (driverId !== undefined && driverId !== null && driverId !== 'undefined' && driverId !== 'null' && driverId !== '') {
      const parsedDriverId = parseInt(driverId);
      if (!isNaN(parsedDriverId) && parsedDriverId > 0) {
        whereClause += ' AND o.driver_id = ?';
        params.push(parsedDriverId);
      }
    }

    const orders = await query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        o.driver_id,
        o.total_usd,
        o.total_lbp,
        -- For drivers, fee_usd and fee_lbp should show driver_fee (what driver earns)
        -- If driver_fee is NULL or 0, fall back to delivery_fee
        CASE 
          WHEN o.driver_fee_usd IS NOT NULL AND o.driver_fee_usd > 0 THEN o.driver_fee_usd
          ELSE COALESCE(o.delivery_fee_usd, 0)
        END as fee_usd,
        CASE 
          WHEN o.driver_fee_lbp IS NOT NULL AND o.driver_fee_lbp > 0 THEN o.driver_fee_lbp
          ELSE COALESCE(o.delivery_fee_lbp, 0)
        END as fee_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.created_at as date,
        o.payment_status,
        o.status as order_status,
        o.deliver_method as delivery_method,
        d.full_name as driver_name,
        d.id as driver_table_id,
        o.customer_name,
        o.customer_phone,
        o.customer_address as customer_location
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);

    // Calculate summary for each driver
    const driverSummaries = {};
    orders.forEach(order => {
      const driverId = order.driver_id;
      if (!driverId) return; // Skip orders without driver_id
      
      const driverName = order.driver_name || `Driver ${driverId}`;
      const key = driverId;
      
      if (!driverSummaries[key]) {
        driverSummaries[key] = {
          driverId: driverId,
          driverName: driverName,
          driver_id: driverId,
          driver_name: driverName,
          ordersSumUsd: 0,
          ordersSumLbp: 0,
          driverFeesUsd: 0,
          driverFeesLbp: 0,
          feeUsd: 0, // Alias for driverFeesUsd
          feeLbp: 0, // Alias for driverFeesLbp
          paymentsReceivedUsd: 0,
          paymentsReceivedLbp: 0,
          oldBalanceUsd: 0,
          oldBalanceLbp: 0,
          newBalanceUsd: 0,
          newBalanceLbp: 0,
          orderCount: 0
        };
      }

      const summary = driverSummaries[key];
      // Use the fee_usd and fee_lbp from the query (already computed with CASE statement)
      // These values prioritize driver_fee over delivery_fee
      const feeUsd = Number(order.fee_usd || 0);
      const feeLbp = Number(order.fee_lbp || 0);
      
      summary.ordersSumUsd += Number(order.total_usd || 0);
      summary.ordersSumLbp += Number(order.total_lbp || 0);
      summary.driverFeesUsd += feeUsd;
      summary.driverFeesLbp += feeLbp;
      summary.feeUsd += feeUsd; // Alias for driverFeesUsd
      summary.feeLbp += feeLbp; // Alias for driverFeesLbp
      summary.orderCount += 1;
      
      // Debug logging for driver fees
      if (feeUsd > 0 || feeLbp > 0) {
        console.log(`Driver ${driverId} (${driverName}): Order ${order.reference} has delivery fees USD=${feeUsd}, LBP=${feeLbp}`);
      } else if (order.delivery_fee_usd == null && order.delivery_fee_lbp == null && 
                 order.driver_fee_usd == null && order.driver_fee_lbp == null) {
        console.log(`⚠️ Driver ${driverId} (${driverName}): Order ${order.reference} has NULL delivery/driver fees`);
      }
    });

    // Calculate total values and get payments
    for (const driverKey in driverSummaries) {
      const summary = driverSummaries[driverKey];
      
      // Get driver info including old balance
      // Only query columns that exist: old_balance_usd and old_balance_lbp
      // Note: balance_usd and balance_lbp columns do NOT exist in drivers table
      try {
        const driverInfo = await query('SELECT old_balance_usd, old_balance_lbp FROM drivers WHERE id = ?', [summary.driverId]);
        if (driverInfo.length > 0) {
          const driver = driverInfo[0];
          // Use old_balance columns (balance_usd and balance_lbp don't exist in drivers table)
          summary.oldBalanceUsd = Number(driver.old_balance_usd || 0);
          summary.oldBalanceLbp = Number(driver.old_balance_lbp || 0);
        } else {
          // Driver not found, set defaults
          summary.oldBalanceUsd = 0;
          summary.oldBalanceLbp = 0;
        }
      } catch (error) {
        console.error(`Error fetching driver balance for driver ${summary.driverId}:`, error.message);
        // If columns don't exist, try to add them or use defaults
        summary.oldBalanceUsd = 0;
        summary.oldBalanceLbp = 0;
      }
      
      // Get payments for this driver (from transactions)
      const payments = await query(`
        SELECT SUM(amount_usd) as total_usd, SUM(amount_lbp) as total_lbp
        FROM transactions
        WHERE actor_type = 'driver' AND actor_id = ? AND tx_type = 'driver_payment'
      `, [summary.driverId]);
      
      if (payments.length > 0 && payments[0].total_usd) {
        summary.paymentsReceivedUsd = Number(payments[0].total_usd || 0);
        summary.paymentsReceivedLbp = Number(payments[0].total_lbp || 0);
      }

      // Calculate new balance (old balance + orders sum + fees - payments)
      summary.newBalanceUsd = summary.oldBalanceUsd + summary.ordersSumUsd + summary.driverFeesUsd - summary.paymentsReceivedUsd;
      summary.newBalanceLbp = summary.oldBalanceLbp + summary.ordersSumLbp + summary.driverFeesLbp - summary.paymentsReceivedLbp;
    }

    // Always return success response, even if empty
    const summaries = Object.values(driverSummaries);
    
    // Ensure all summaries have the correct driver fields (remove any accidentally added client fields)
    const cleanSummaries = summaries.map(summary => ({
      driverId: summary.driverId,
      driver_id: summary.driver_id,
      driverName: summary.driverName,
      driver_name: summary.driver_name,
      ordersSumUsd: summary.ordersSumUsd,
      ordersSumLbp: summary.ordersSumLbp,
      driverFeesUsd: summary.driverFeesUsd,
      driverFeesLbp: summary.driverFeesLbp,
      feeUsd: summary.feeUsd,
      feeLbp: summary.feeLbp,
      paymentsReceivedUsd: summary.paymentsReceivedUsd,
      paymentsReceivedLbp: summary.paymentsReceivedLbp,
      oldBalanceUsd: summary.oldBalanceUsd,
      oldBalanceLbp: summary.oldBalanceLbp,
      newBalanceUsd: summary.newBalanceUsd,
      newBalanceLbp: summary.newBalanceLbp,
      orderCount: summary.orderCount
    }));
    
    // Debug logging for driver summaries
    console.log(`📊 Driver Accounting Summary: ${cleanSummaries.length} drivers, ${orders.length} orders`);
    cleanSummaries.forEach(summary => {
      console.log(`Driver ${summary.driverId} (${summary.driverName}): ` +
        `Orders=${summary.orderCount}, ` +
        `Fees USD=${summary.driverFeesUsd}, LBP=${summary.driverFeesLbp}, ` +
        `Orders Sum USD=${summary.ordersSumUsd}, LBP=${summary.ordersSumLbp}`);
    });
    
    res.json({ 
      success: true, 
      data: orders || [],
      summaries: cleanSummaries || [],
      totalOrders: orders.length,
      totalDrivers: cleanSummaries.length
    });
  } catch (error) {
    console.error('❌ Error fetching drivers accounting:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    
    // Return more helpful error message
    let errorMessage = 'Internal server error';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.detail) {
      errorMessage = error.detail;
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      data: [],
      summaries: [],
      totalOrders: 0,
      totalDrivers: 0,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      } : undefined
    });
  }
});

// Get third-party accounting data (supports both /third-party and /thirdparty)
// Shared handler function
const thirdPartyHandler = async (req, res) => {
  try {
    const { fromDate, toDate, thirdPartyId, thirdPartyName, statusFilter, paymentStatus } = req.query;
    
    // Include orders with delivery method = 'third_party'
    // Exclude orders that have been cashed out (moved to history)
    let whereClause = 'WHERE o.deliver_method = ? AND (o.moved_to_history IS NULL OR o.moved_to_history = false)';
    const params = ['third_party'];
    
    // Filter by status only if explicitly requested
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'delivered') {
        whereClause += ' AND o.status = ?';
        params.push('delivered');
      } else if (statusFilter === 'prepaid') {
        whereClause += ' AND (o.cashbox_applied_on_create = true OR ' +
                       '(o.payment_status IN (?, ?) AND o.type IN (?, ?)))';
        params.push('prepaid', 'paid', 'ecommerce', 'instant');
      }
    }
    
    if (paymentStatus) {
      whereClause += ' AND o.payment_status = ?';
      params.push(paymentStatus);
    }
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }

    // Optional: Filter by specific third party name if provided
    if (thirdPartyId || thirdPartyName) {
      const thirdParty = thirdPartyId || thirdPartyName;
      whereClause += ' AND o.third_party_name = ?';
      params.push(thirdParty);
    }

    const orders = await query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        o.third_party_name,
        o.total_usd,
        o.total_lbp,
        o.total_usd as order_price_usd,
        o.total_lbp as order_price_lbp,
        o.third_party_fee_usd,
        o.third_party_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.created_at as date,
        o.payment_status,
        o.status as order_status,
        o.customer_name,
        o.customer_address as customer_location,
        d.full_name as driver_name,
        COALESCE(c.business_name, o.brand_name, 'Unknown Client') as client_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);

    // Calculate summary for each third party
    // Group by third_party_name, but use 'Unnamed Third Party' if name is missing
    const thirdPartySummaries = {};
    orders.forEach(order => {
      // Use third_party_name if available, otherwise use a default name
      // This ensures orders with deliver_method='third_party' but no third_party_name are still included
      const thirdPartyName = order.third_party_name && order.third_party_name.trim() !== '' 
        ? order.third_party_name 
        : 'Unnamed Third Party';
      const key = thirdPartyName;
      
      if (!thirdPartySummaries[key]) {
        thirdPartySummaries[key] = {
          thirdPartyName: thirdPartyName,
          third_party_name: thirdPartyName,
          ordersSumUsd: 0,
          ordersSumLbp: 0,
          deliveryFeesUsd: 0,
          deliveryFeesLbp: 0,
          thirdPartyFeesUsd: 0,
          thirdPartyFeesLbp: 0,
          driverFeesUsd: 0,
          driverFeesLbp: 0,
          paymentsReceivedUsd: 0,
          paymentsReceivedLbp: 0,
          orderCount: 0
        };
      }

      const summary = thirdPartySummaries[key];
      summary.ordersSumUsd += Number(order.total_usd || 0);
      summary.ordersSumLbp += Number(order.total_lbp || 0);
      summary.deliveryFeesUsd += Number(order.delivery_fee_usd || 0);
      summary.deliveryFeesLbp += Number(order.delivery_fee_lbp || 0);
      summary.thirdPartyFeesUsd += Number(order.third_party_fee_usd || 0);
      summary.thirdPartyFeesLbp += Number(order.third_party_fee_lbp || 0);
      summary.driverFeesUsd += Number(order.driver_fee_usd || 0);
      summary.driverFeesLbp += Number(order.driver_fee_lbp || 0);
      summary.orderCount += 1;
    });

    // Calculate total values and get payments
    for (const thirdPartyKey in thirdPartySummaries) {
      const summary = thirdPartySummaries[thirdPartyKey];
      
      // Get payments for this third party (from transactions)
      // Note: actor_id is INTEGER in transactions table, but third parties are identified by name (string)
      // Since we can't directly match string names to INTEGER actor_id, we'll skip the payment query
      // Third party payments would need to be tracked differently if needed
      // For now, set payments to 0 as third parties typically don't have separate payment records
      summary.paymentsReceivedUsd = 0;
      summary.paymentsReceivedLbp = 0;
      
      // If we need to query payments in the future, we would need to either:
      // 1. Store third party names in a separate mapping table with IDs
      // 2. Change actor_id to TEXT in transactions table
      // 3. Use a different approach to track third party payments

      // Calculate total value (orders sum + delivery fees + third party fees)
      summary.totalValueUsd = summary.ordersSumUsd + summary.deliveryFeesUsd + summary.thirdPartyFeesUsd;
      summary.totalValueLbp = summary.ordersSumLbp + summary.deliveryFeesLbp + summary.thirdPartyFeesLbp;
    }

    // Always return success response, even if empty
    const summaries = Object.values(thirdPartySummaries);
    
    res.json({ 
      success: true, 
      data: orders || [],
      summaries: summaries || [],
      totalOrders: orders.length,
      totalThirdParties: summaries.length
    });
  } catch (error) {
    console.error('Error fetching third-party accounting:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      data: [],
      summaries: []
    });
  }
};

router.get('/third-party', authenticateToken, thirdPartyHandler);
router.get('/thirdparty', authenticateToken, thirdPartyHandler);

// Get exchange rates - MUST be before parameterized routes
router.get('/exchange-rates', authenticateToken, async (req, res) => {
  try {
    // Try to get exchange rate from database
    let exchangeRates = [];

    try {
      const dbType = currentDatabase();
      if (dbType === 'postgresql') {
        // PostgreSQL schema: id, lbp_per_usd, effective_at (NO created_at column)
        // CRITICAL: PostgreSQL exchange_rates table does NOT have created_at column
        // Only select: lbp_per_usd, effective_at - DO NOT SELECT created_at
        const queryString = 'SELECT lbp_per_usd as usd_to_lbp_rate, effective_at FROM exchange_rates ORDER BY effective_at DESC LIMIT 1';
        
        // Runtime validation: Ensure created_at is never in the query
        if (queryString.includes('created_at')) {
          console.error('ERROR: Query string contains created_at! This should never happen!');
          throw new Error('Invalid query: created_at column does not exist in exchange_rates table');
        }
        
        const rows = await query(queryString);
        exchangeRates = rows.map(row => ({
          usd_to_lbp_rate: Number(row.usd_to_lbp_rate || row.lbp_per_usd || 89000),
          effective_at: row.effective_at,
          created_at: row.effective_at // Use effective_at as created_at for API compatibility
        }));
      } else {
        // MySQL/SQLite fallback - these may have created_at column
        const rows = await query('SELECT rate_usd_to_lbp as usd_to_lbp_rate, created_at FROM exchange_rates WHERE active = true ORDER BY created_at DESC LIMIT 1');
        exchangeRates = rows.map(row => ({
          usd_to_lbp_rate: Number(row.usd_to_lbp_rate || 89000),
                    created_at: row.created_at,
          effective_at: row.created_at // Use created_at as effective_at for compatibility
        }));
      }
    } catch (dbError) {
      console.error('Error fetching exchange rates from database:', dbError);
      // Continue with default rate if database query fails
      exchangeRates = [];
    }
    
    // If no exchange rates found, return default
    if (exchangeRates.length === 0) {
      exchangeRates = [{
        usd_to_lbp_rate: Number(process.env.EXCHANGE_RATE || 89000),
        effective_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }];
    }
    
    res.json({ 
      success: true, 
      data: exchangeRates 
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Cash out individual order - MUST be before parameterized routes
router.post('/cashout/:id', authenticateToken, async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(500).json({
      success: false,
      message: 'Database connection not available'
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const orderId = parseInt(id);
    
    // Log request details for debugging
    console.log('🔍 Cashout request:', {
      orderId: orderId,
      queryParams: req.query,
      bodyParams: req.body,
      userId: req.user?.id
    });
    
    if (!orderId || isNaN(orderId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }
    
    // Get order details
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orderResult.rows[0];
    
    // ========================================================================
    // IMPORTANT: CASHOUT OPERATIONS ARE SEPARATE BY CONTEXT
    // ========================================================================
    // - Driver cashout (from accounting/drivers): Adds driver fees to cashbox as INCOME
    //   This does NOT affect client cashout - they are independent!
    // - Client cashout (from accounting/clients): Processes client payment
    //   This does NOT affect driver cashout - they are independent!
    // - Third party cashout: Processes third party payments
    //   This does NOT affect driver or client cashout - all are independent!
    // ========================================================================
    
    // Check for mode parameter - if 'driver', we're doing a driver cashout (mark as cashed for driver accounting)
    // If 'third_party' or 'thirdparty', we're doing a third-party cashout
    // Support both query param and body param
    const modeFromQuery = req.query.mode;
    const modeFromBody = req.body?.mode || req.body?.Mode;
    const mode = (modeFromQuery || modeFromBody || 'client').toString().toLowerCase().trim();
    const isDriverCashout = mode === 'driver';
    const isThirdPartyCashout = mode === 'third_party' || mode === 'thirdparty' || mode === 'third-party';
    
    console.log('🔍 Cashout mode detection:', {
      modeFromQuery,
      modeFromBody,
      finalMode: mode,
      isDriverCashout,
      isThirdPartyCashout,
      orderStatus: order.status,
      paymentStatus: order.payment_status,
      note: 'Driver cashout and third-party cashout are SEPARATE from client cashout - they do not affect each other'
    });
    
    // Check if order is eligible for cashout
    const orderStatus = String(order.status || '').toLowerCase().trim();
    const paymentStatus = String(order.payment_status || '').toLowerCase().trim();
    
    // For driver cashout and third-party cashout, we only need the order to be delivered/completed
    // For client cashout, we need both delivered/completed AND paid
    if (orderStatus !== 'delivered' && orderStatus !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Order must be delivered or completed to cash out. Current status: ${order.status || 'unknown'}`,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        mode: mode,
        isDriverCashout: isDriverCashout,
        isThirdPartyCashout: isThirdPartyCashout
      });
    }
    
    // For driver cashout and third-party cashout, payment_status is optional
    // For client cashout, payment_status must be 'paid'
    if (!isDriverCashout && !isThirdPartyCashout && paymentStatus !== 'paid' && paymentStatus !== 'Paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Order must be paid to cash out. Current payment status: ${order.payment_status || 'unknown'}`,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        mode: mode,
        isDriverCashout: isDriverCashout,
        isThirdPartyCashout: isThirdPartyCashout
      });
    }
    
    // For driver cashout and third-party cashout, we can still process even if accounting_cashed is true
    // (it might be cashed for client but not for driver/third-party accounting)
    // For client cashout, check if already cashed
    if (!isDriverCashout && !isThirdPartyCashout && (order.accounting_cashed || order.moved_to_history)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Order already cashed out',
        accounting_cashed: order.accounting_cashed,
        moved_to_history: order.moved_to_history,
        mode: mode
      });
    }
    
    // For driver cashout and third-party cashout, warn if already cashed but still allow it
    if ((isDriverCashout || isThirdPartyCashout) && order.accounting_cashed) {
      console.log(`⚠️ ${isDriverCashout ? 'Driver' : 'Third-party'} cashout: Order ${orderId} already has accounting_cashed=true, but proceeding for ${isDriverCashout ? 'driver' : 'third-party'} accounting`);
    }
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    // Process cashout based on mode
    if (isDriverCashout) {
      // For driver cashout: 
      // 1. Add driver fees to cashbox (income - we collected from clients)
      // 2. Move order to order history
      
      // Use driver_fee if available, otherwise use delivery_fee
      // These are the fees that should enter the cashbox as income
      const driverFeeUsd = Number(order.driver_fee_usd || order.delivery_fee_usd || 0);
      const driverFeeLbp = Number(order.driver_fee_lbp || order.delivery_fee_lbp || 0);
      
      console.log(`💰 Driver Cashout - Order ${orderId}:`, {
        driver_id: order.driver_id,
        driver_fee_usd: order.driver_fee_usd,
        driver_fee_lbp: order.driver_fee_lbp,
        delivery_fee_usd: order.delivery_fee_usd,
        delivery_fee_lbp: order.delivery_fee_lbp,
        calculated_fee_usd: driverFeeUsd,
        calculated_fee_lbp: driverFeeLbp
      });
      
      if (order.driver_id && (driverFeeUsd > 0 || driverFeeLbp > 0)) {
        // IMPORTANT: Driver cashout is SEPARATE from client cashout
        // This adds driver fees to cashbox as INCOME (money we collected from clients for driver fees)
        // This does NOT affect client cashout - they are independent operations
        console.log(`✅ Processing DRIVER cashout (separate from client cashout): Adding ${driverFeeUsd} USD / ${driverFeeLbp} LBP to cashbox as income`);
        
        const cashboxOps = require('../utils/cashboxAtomicOperations');
        
        // Check if order was prepaid (cashbox_applied_on_create = true)
        // If prepaid, also add total USD and LBP to cash account
        const isPrepaidOrder = order.cashbox_applied_on_create === true;
        const totalUsd = Number(order.total_usd || 0);
        const totalLbp = Number(order.total_lbp || 0);
        
        if (isPrepaidOrder && (totalUsd > 0 || totalLbp > 0)) {
          console.log(`💰 Prepaid order detected - Also adding total ${totalUsd} USD / ${totalLbp} LBP to cash account`);
          
          // Add total amount to cashbox
          await cashboxOps.updateCashboxBalances(client, totalUsd, totalLbp, 'cash');
          
          // Create cashbox entry for prepaid order total
          const prepaidEntryDescription = `Prepaid order total from order ${order.order_ref || orderId} - ${totalUsd} USD / ${totalLbp} LBP`;
          
          await cashboxOps.createCashboxEntry(client, {
            entry_type: 'cash_in',
            amount_usd: totalUsd,
            amount_lbp: totalLbp,
            actor_type: 'client',
            actor_id: order.client_id || null,
            order_id: orderId,
            description: prepaidEntryDescription,
            account_type: 'cash',
            created_by: req.user.id
          });
          
          // Create accounting transaction for prepaid order total
          await cashboxOps.createTransaction(client, {
            tx_type: 'client_payment',
            amount_usd: totalUsd,
            amount_lbp: totalLbp,
            actor_type: 'client',
            actor_id: order.client_id || null,
            order_id: orderId,
            debit_account: 'client_payable',
            credit_account: 'cash_account',
            description: prepaidEntryDescription,
            created_by: req.user.id
          });
          
          console.log(`✅ Prepaid order total added to cash account: ${totalUsd} USD / ${totalLbp} LBP`);
        }
        
        // Add driver fees to cashbox
        const cashoutResult = await processDriverCashout(client, {
          amount_usd: driverFeeUsd,
          amount_lbp: driverFeeLbp,
          driver_id: order.driver_id,
          order_ids: [orderId],
          userId: req.user.id,
          description: `Driver fee income from order ${order.order_ref || orderId} - ${driverFeeUsd} USD / ${driverFeeLbp} LBP`
        });
        
        // Verify cashbox entry was created and fees were added to cashbox
        if (cashoutResult && cashoutResult.entry) {
          console.log(`✅ VERIFIED: Cashbox entry created successfully!`);
          console.log(`   - Entry ID: ${cashoutResult.entry.id}`);
          console.log(`   - Entry Type: ${cashoutResult.entry.entry_type || 'income'}`);
          console.log(`   - Amount USD: ${cashoutResult.entry.amount_usd || driverFeeUsd}`);
          console.log(`   - Amount LBP: ${cashoutResult.entry.amount_lbp || driverFeeLbp}`);
          console.log(`   - Order ID: ${cashoutResult.entry.order_id || orderId}`);
        } else {
          console.error('❌ CRITICAL WARNING: Cashbox entry may not have been created!');
          console.error('   Cashout result:', JSON.stringify(cashoutResult, null, 2));
          // Don't fail the request, but log the issue
        }
        
        // Verify cashbox balance was updated
        try {
          const verifyCashbox = await client.query('SELECT cash_balance_usd, cash_balance_lbp FROM cashbox WHERE id = 1');
          if (verifyCashbox.rows && verifyCashbox.rows.length > 0) {
            const currentBalance = verifyCashbox.rows[0];
            console.log(`✅ VERIFIED: Current cashbox balance - USD: ${currentBalance.cash_balance_usd}, LBP: ${currentBalance.cash_balance_lbp}`);
          }
        } catch (verifyError) {
          console.error('❌ Error verifying cashbox balance:', verifyError);
        }
        
        const totalAdded = isPrepaidOrder ? `${driverFeeUsd + totalUsd} USD / ${driverFeeLbp + totalLbp} LBP (fees + prepaid total)` : `${driverFeeUsd} USD / ${driverFeeLbp} LBP (fees only)`;
        console.log(`✅ Driver cashout completed - ${totalAdded} added to cashbox`);
        console.log(`📝 NOTE: This driver cashout is SEPARATE from client cashout - they are independent operations!`);
      } else {
        // If no driver fee, just mark as cashed (no cashbox entry needed)
        console.warn(`⚠️ Order ${orderId} has no driver fees (USD: ${driverFeeUsd}, LBP: ${driverFeeLbp}) - skipping cashbox entry`);
        await client.query(
          `UPDATE orders SET accounting_cashed = true WHERE id = $1`,
          [orderId]
        );
      }
      
      // Move order to history (mark as moved_to_history)
      // For driver cashout, move to history immediately so order is removed from accounting/drivers page
      try {
        await client.query(
          `UPDATE orders SET moved_to_history = true, moved_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [orderId]
        );
        console.log(`✅ Order ${orderId} (${order.order_ref}) moved to history after driver cashout - removed from accounting/drivers page`);
      } catch (historyError) {
        // If moved_to_history column doesn't exist, that's okay - order is already marked as cashed
        if (historyError.message && historyError.message.includes('does not exist')) {
          console.warn('⚠️ moved_to_history column not found, order already marked as accounting_cashed');
        } else {
          throw historyError;
        }
      }
    } else if (isThirdPartyCashout) {
      // IMPORTANT: Third-party cashout is SEPARATE from driver and client cashout
      // This processes third-party payment: (driver_fee - third_party_fee) enters cash account
      // This does NOT affect driver or client cashout - they are independent operations
      console.log(`✅ Processing THIRD-PARTY cashout (separate from driver and client cashout): Order ${orderId}`);
      
      // Check if order has delivery method = 'third_party'
      const deliverMethod = String(order.deliver_method || '').toLowerCase().trim();
      if (deliverMethod !== 'third_party') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Order does not have delivery method 'third_party'. Current delivery method: ${order.deliver_method || 'unknown'}`
        });
      }
      
      // Calculate driver fee (our fee) and third party fee
      const driverFeeUsd = Number(order.driver_fee_usd || order.delivery_fee_usd || 0);
      const driverFeeLbp = Number(order.driver_fee_lbp || order.delivery_fee_lbp || 0);
      const thirdPartyFeeUsd = Number(order.third_party_fee_usd || 0);
      const thirdPartyFeeLbp = Number(order.third_party_fee_lbp || 0);
      
      // Calculate net amount: (driver_fee - third_party_fee)
      // This is the amount we keep after paying the third party
      const netFeeUsd = driverFeeUsd - thirdPartyFeeUsd;
      const netFeeLbp = driverFeeLbp - thirdPartyFeeLbp;
      
      console.log(`💰 Third-party cashout calculation:`, {
        driver_fee_usd: driverFeeUsd,
        driver_fee_lbp: driverFeeLbp,
        third_party_fee_usd: thirdPartyFeeUsd,
        third_party_fee_lbp: thirdPartyFeeLbp,
        net_fee_usd: netFeeUsd,
        net_fee_lbp: netFeeLbp,
        third_party_name: order.third_party_name
      });
      
      if (netFeeUsd <= 0 && netFeeLbp <= 0) {
        console.warn(`⚠️ Order ${orderId} has zero or negative net fee after third-party deduction - skipping cashbox entry`);
        // Still mark as cashed and moved to history
        await client.query(
          `UPDATE orders SET accounting_cashed = true, moved_to_history = true, moved_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [orderId]
        );
      } else {
        // Add net fee to cashbox (our profit after paying third party)
        const cashboxOps = require('../utils/cashboxAtomicOperations');
        await cashboxOps.updateCashboxBalances(client, netFeeUsd, netFeeLbp, 'cash');
        
        // Create cashbox entry for third-party cashout
        const thirdPartyName = order.third_party_name || 'Unknown Third Party';
        const entryDescription = `Third-party cashout - Net fee (driver fee - third party fee) from order ${order.order_ref || orderId} - ${netFeeUsd} USD / ${netFeeLbp} LBP (Third party: ${thirdPartyName})`;
        
        await cashboxOps.createCashboxEntry(client, {
          entry_type: 'cash_in',
          amount_usd: netFeeUsd,
          amount_lbp: netFeeLbp,
          actor_type: 'third_party',
          actor_id: thirdPartyName,
          order_id: orderId,
          description: entryDescription,
          account_type: 'cash',
          created_by: req.user.id
        });
        
        // Create accounting transaction
        await cashboxOps.createTransaction(client, {
          tx_type: 'third_party_payment',
          amount_usd: netFeeUsd,
          amount_lbp: netFeeLbp,
          actor_type: 'third_party',
          actor_id: thirdPartyName,
          order_id: orderId,
          debit_account: 'third_party_payable',
          credit_account: 'cash_account',
          description: entryDescription,
          created_by: req.user.id
        });
        
        console.log(`✅ Third-party cashout completed - Net fee ${netFeeUsd} USD / ${netFeeLbp} LBP added to cash account`);
      }
      
      // Mark order as moved to history (remove from accounting/third-party page)
      await client.query(
        `UPDATE orders SET accounting_cashed = true, moved_to_history = true, moved_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [orderId]
      );
      console.log(`✅ Order ${orderId} (${order.order_ref}) moved to history after third-party cashout`);
    } else {
      // IMPORTANT: Client cashout is SEPARATE from driver cashout
      // This processes client payment (money from client for the order)
      // This does NOT affect driver cashout - they are independent operations
      console.log(`✅ Processing CLIENT cashout (separate from driver cashout): Order ${orderId}`);
      
      // Get order details for cashout logic
      const orderType = String(order.type || '').toLowerCase().trim();
      const paymentStatus = String(order.payment_status || '').toLowerCase().trim();
      const isPrepaidOrder = order.cashbox_applied_on_create === true;
      
      // CLIENT CASHOUT LOGIC:
      // 1. If order is prepaid (cashbox_applied_on_create = true): NOTHING happens
      // 2. If payment_status is 'prepaid': REMOVE total fee LBP and USD from cash account
      // 3. If payment_status is 'paid': ADD total LBP and USD to cash account
      // 4. If order type is 'ecommerce' or 'instant': REMOVE total LBP and USD from cash account
      // 5. If order type is 'go-to-market': ADD total LBP and USD to cash account
      
      if (isPrepaidOrder) {
        // Prepaid order cashout: ADD total LBP and USD to cash account
        // When prepaid order is cashed out, the total amount enters the cashbox
        const totalUsd = Number(order.total_usd || 0);
        const totalLbp = Number(order.total_lbp || 0);
        
        console.log(`💰 Prepaid order cashout - ADDING total ${totalUsd} USD / ${totalLbp} LBP to cash account`);
        
        // Add total amount to cashbox
        const cashboxOps = require('../utils/cashboxAtomicOperations');
        await cashboxOps.updateCashboxBalances(client, totalUsd, totalLbp, 'cash');
        
        // Create cashbox entry for prepaid order total
        const entryDescription = `Prepaid order cashout - Total ${totalUsd} USD / ${totalLbp} LBP added to cash account (Order ${order.order_ref || orderId})`;
        
        const entry = await cashboxOps.createCashboxEntry(client, {
          entry_type: 'cash_in',
          amount_usd: totalUsd,
          amount_lbp: totalLbp,
          actor_type: 'client',
          actor_id: order.client_id || null,
          order_id: orderId,
          description: entryDescription,
          account_type: 'cash',
          created_by: req.user.id
        });
        
        // Create accounting transaction for prepaid order total
        await cashboxOps.createTransaction(client, {
          tx_type: 'client_payment',
          amount_usd: totalUsd,
          amount_lbp: totalLbp,
          actor_type: 'client',
          actor_id: order.client_id || null,
          order_id: orderId,
          debit_account: 'client_payable',
          credit_account: 'cash_account',
          description: entryDescription,
          created_by: req.user.id
        });
        
        // NOTE: Driver fees are handled separately in driver cashout, not during client cashout
        // They are independent operations
        
        // Mark order as cashed
        // Check if order should be moved to history (must be completed + paid + cashed)
        const orderStatusCheck = await client.query('SELECT status, payment_status FROM orders WHERE id = $1', [orderId]);
        const orderStatus = orderStatusCheck.rows[0]?.status || '';
        const orderPaymentStatus = String(orderStatusCheck.rows[0]?.payment_status || '').toLowerCase().trim();
        const isCompleted = orderStatus === 'completed';
        const isPaid = orderPaymentStatus === 'paid';
        
        // Only move to history if order is completed AND paid
        const shouldMoveToHistory = isCompleted && isPaid;
        
        if (shouldMoveToHistory) {
          await client.query(
            `UPDATE orders SET accounting_cashed = true, moved_to_history = true, moved_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          console.log(`✅ Prepaid order cashed out and moved to history - Total ${totalUsd} USD / ${totalLbp} LBP (completed + paid + cashed out)`);
        } else {
          await client.query(
            `UPDATE orders SET accounting_cashed = true, updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          console.log(`✅ Prepaid order cashed out - Total ${totalUsd} USD / ${totalLbp} LBP (not moved to history yet - status: ${orderStatus}, payment: ${orderPaymentStatus})`);
        }
      } else {
        // Non-prepaid order: Apply cashout logic based on order type and payment status
        // Requirements:
        // 1. instant/ecommerce orders with payment_status='paid': REMOVE total (money was added on delivery, now cashing out)
        // 2. go-to-market orders: ADD total (money was removed on creation, now returning it)
        const amount_usd = Number(order.total_usd || 0);
        const amount_lbp = Number(order.total_lbp || 0);
        
        // Determine if we should ADD or REMOVE from cashbox
        // Priority: Check order type FIRST, then payment status
        let shouldAddToCashbox = false;
        let cashoutAmountUsd = amount_usd;
        let cashoutAmountLbp = amount_lbp;
        
        if (orderType === 'go-to-market' || orderType === 'go_to_market') {
          // Go-to-market orders: ADD total back to cash account
          // Money was removed on creation, now we're returning it on cashout
          shouldAddToCashbox = true; // ADD to cashbox
          console.log(`💰 Order type is '${orderType}' - ADDING ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP back to cash account (returning money deducted on creation)`);
        } else if (orderType === 'ecommerce' || orderType === 'instant') {
          // Ecommerce/instant orders with payment_status='paid': REMOVE total from cash account
          // Money was added on delivery when status='delivered' and payment_status='paid', now we're cashing out
          if (paymentStatus === 'paid') {
            shouldAddToCashbox = false; // REMOVE from cashbox
            console.log(`💰 Order type is '${orderType}' with payment_status='paid' - REMOVING ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP from cash account (money was added on delivery, now cashing out)`);
          } else {
            // For other payment statuses, default to REMOVE
            shouldAddToCashbox = false;
            console.log(`💰 Order type is '${orderType}' with payment_status='${paymentStatus}' - REMOVING ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP from cash account`);
          }
        } else if (paymentStatus === 'prepaid') {
          // Payment status is prepaid: REMOVE total from cash account
          cashoutAmountUsd = Number(order.delivery_fee_usd || order.total_usd || 0);
          cashoutAmountLbp = Number(order.delivery_fee_lbp || order.total_lbp || 0);
          shouldAddToCashbox = false; // REMOVE from cashbox
          console.log(`💰 Payment status is 'prepaid' - REMOVING ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP from cash account`);
        } else {
          // Default: REMOVE from cashbox (traditional cashout)
          shouldAddToCashbox = false;
          console.log(`💰 Default cashout - REMOVING ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP from cash account`);
        }
        
        // Apply cashbox update
        const cashDeltaUsd = shouldAddToCashbox ? cashoutAmountUsd : -cashoutAmountUsd;
        const cashDeltaLbp = shouldAddToCashbox ? cashoutAmountLbp : -cashoutAmountLbp;
        
        // Update cashbox balances
        // Import functions from cashboxAtomicOperations
        const cashboxOps = require('../utils/cashboxAtomicOperations');
        await cashboxOps.updateCashboxBalances(client, cashDeltaUsd, cashDeltaLbp, 'cash');
        
        // Create cashbox entry
        const entryDescription = shouldAddToCashbox 
          ? `Client cashout - Added ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP to cash account (Order ${order.order_ref || orderId})`
          : `Client cashout - Removed ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP from cash account (Order ${order.order_ref || orderId})`;
        
        const entry = await cashboxOps.createCashboxEntry(client, {
          entry_type: shouldAddToCashbox ? 'cash_in' : 'client_cashout',
          amount_usd: cashoutAmountUsd,
          amount_lbp: cashoutAmountLbp,
          actor_type: 'client',
          actor_id: order.client_id || null,
          order_id: orderId,
          description: entryDescription,
          account_type: 'cash',
          created_by: req.user.id
        });
        
        // Create accounting transaction
        await cashboxOps.createTransaction(client, {
          tx_type: 'client_payment',
          amount_usd: cashoutAmountUsd,
          amount_lbp: cashoutAmountLbp,
          actor_type: 'client',
          actor_id: order.client_id || null,
          order_id: orderId,
          debit_account: shouldAddToCashbox ? 'client_payable' : 'cash_account',
          credit_account: shouldAddToCashbox ? 'cash_account' : 'client_payable',
          description: entryDescription,
          created_by: req.user.id
        });
        
        // NOTE: Driver fees are handled separately in driver cashout, not during client cashout
        // They are independent operations
        
        // Mark order as moved to history
        // Only move to history if order is completed AND paid AND cashed out
        const orderStatusCheck = await client.query('SELECT status, payment_status FROM orders WHERE id = $1', [orderId]);
        const orderStatus = orderStatusCheck.rows[0]?.status || '';
        const orderPaymentStatus = String(orderStatusCheck.rows[0]?.payment_status || '').toLowerCase().trim();
        const isCompleted = orderStatus === 'completed';
        const isPaid = orderPaymentStatus === 'paid';
        
        // Only move to history if order is completed AND paid
        const shouldMoveToHistory = isCompleted && isPaid;
        
        if (shouldMoveToHistory) {
          await client.query(
            `UPDATE orders SET accounting_cashed = true, moved_to_history = true, moved_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          console.log(`✅ Order ${orderId} (${order.order_ref}) cashed out and moved to history: completed + paid + cashed out`);
        } else {
          await client.query(
            `UPDATE orders SET accounting_cashed = true, updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          console.log(`✅ Client cashout completed - ${shouldAddToCashbox ? 'ADDED' : 'REMOVED'} ${cashoutAmountUsd} USD / ${cashoutAmountLbp} LBP ${shouldAddToCashbox ? 'to' : 'from'} cash account (not moved to history yet - status: ${orderStatus}, payment: ${orderPaymentStatus})`);
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('cashbox-update', {
        orderRef: order.order_ref,
        action: 'order_cashout'
      });
      
      io.emit('accounting-update', {
        orderId: orderId,
        action: 'cashout'
      });
    }
    
    // Calculate the amounts that were processed
    let processedUsd = 0;
    let processedLbp = 0;
    let cashboxEntryInfo = null;
    
    if (isDriverCashout) {
      processedUsd = Number(order.driver_fee_usd || order.delivery_fee_usd || 0);
      processedLbp = Number(order.driver_fee_lbp || order.delivery_fee_lbp || 0);
      
      // Get the cashbox entry that was just created (for verification)
      if (order.driver_id && (processedUsd > 0 || processedLbp > 0)) {
        try {
          const entryResult = await client.query(
            `SELECT id, entry_type, amount_usd, amount_lbp, description, created_at 
             FROM cashbox_entries 
             WHERE order_id = $1 AND actor_type = 'driver' AND actor_id = $2 
             ORDER BY created_at DESC LIMIT 1`,
            [orderId, order.driver_id]
          );
          if (entryResult.rows && entryResult.rows.length > 0) {
            cashboxEntryInfo = entryResult.rows[0];
            console.log(`✅ Confirmed cashbox entry exists: ID ${cashboxEntryInfo.id}`);
          }
        } catch (entryQueryError) {
          console.error('Error querying cashbox entry:', entryQueryError);
        }
      }
    } else if (isThirdPartyCashout) {
      const driverFeeUsd = Number(order.driver_fee_usd || order.delivery_fee_usd || 0);
      const driverFeeLbp = Number(order.driver_fee_lbp || order.delivery_fee_lbp || 0);
      const thirdPartyFeeUsd = Number(order.third_party_fee_usd || 0);
      const thirdPartyFeeLbp = Number(order.third_party_fee_lbp || 0);
      processedUsd = driverFeeUsd - thirdPartyFeeUsd;
      processedLbp = driverFeeLbp - thirdPartyFeeLbp;
      
      // Get the cashbox entry that was just created (for verification)
      const thirdPartyNameForQuery = order.third_party_name || 'Unknown Third Party';
      if ((processedUsd > 0 || processedLbp > 0)) {
        try {
          const entryResult = await client.query(
            `SELECT id, entry_type, amount_usd, amount_lbp, description, created_at 
             FROM cashbox_entries 
             WHERE order_id = $1 AND actor_type = 'third_party' AND actor_id = $2 
             ORDER BY created_at DESC LIMIT 1`,
            [orderId, thirdPartyNameForQuery]
          );
          if (entryResult.rows && entryResult.rows.length > 0) {
            cashboxEntryInfo = entryResult.rows[0];
            console.log(`✅ Confirmed cashbox entry exists: ID ${cashboxEntryInfo.id}`);
          }
        } catch (entryQueryError) {
          console.error('Error querying cashbox entry:', entryQueryError);
        }
      }
    } else {
      processedUsd = Number(order.total_usd || 0);
      processedLbp = Number(order.total_lbp || 0);
    }
    
    res.json({
      success: true,
      message: isDriverCashout 
        ? `Driver fees (${processedUsd} USD / ${processedLbp} LBP) added to cashbox as INCOME and order moved to history` 
        : isThirdPartyCashout
        ? `Third-party net fee (${processedUsd} USD / ${processedLbp} LBP) added to cashbox and order moved to history`
        : 'Order cashed out successfully',
      data: {
        order_id: orderId,
        order_ref: order.order_ref,
        mode: mode,
        amount_usd: processedUsd,
        amount_lbp: processedLbp,
        moved_to_history: true,
        cashbox_entry: cashboxEntryInfo ? {
          id: cashboxEntryInfo.id,
          entry_type: cashboxEntryInfo.entry_type,
          amount_usd: cashboxEntryInfo.amount_usd,
          amount_lbp: cashboxEntryInfo.amount_lbp,
          description: cashboxEntryInfo.description
        } : null,
        note: isDriverCashout 
          ? 'Driver cashout is SEPARATE from client and third-party cashout - they are independent operations'
          : isThirdPartyCashout
          ? 'Third-party cashout is SEPARATE from driver and client cashout - they are independent operations'
          : 'Client cashout is SEPARATE from driver and third-party cashout - they are independent operations'
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('❌ Error processing order cashout:', {
      message: error.message,
      stack: error.stack,
      orderId: req.params.id,
      userId: req.user?.id,
      errorName: error.name,
      errorCode: error.code,
      errorDetail: error.detail,
      queryParams: req.query,
      bodyParams: req.body
    });
    
    // Return more specific error messages
    let statusCode = 500;
    let errorMessage = 'Failed to process order cashout';
    
    if (error.message.includes('does not exist') || error.message.includes('column')) {
      statusCode = 500;
      errorMessage = `Database schema error: ${error.message}`;
    } else if (error.message.includes('violates foreign key') || error.message.includes('constraint')) {
      statusCode = 400;
      errorMessage = `Data integrity error: ${error.message}`;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code,
        detail: error.detail
      } : undefined
    });
  } finally {
    client.release();
  }
});

// Process driver cashout - MUST be before /drivers/:id route
router.post('/drivers/:id/cashout', authenticateToken, async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(500).json({
      success: false,
      message: 'Database connection not available'
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { amount_usd, amount_lbp, order_ids = [], description } = req.body;
    
    const driverId = parseInt(id);
    if (!driverId || isNaN(driverId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid driver ID'
      });
    }
    
    // Validate driver exists
    const driverResult = await client.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    if (driverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    const driver = driverResult.rows[0];
    
    // If no order_ids provided, find eligible orders for this driver
    let eligibleOrderIds = order_ids;
    if (eligibleOrderIds.length === 0) {
      // Find delivered, paid orders that haven't been cashed out
      const ordersResult = await client.query(
        `SELECT id, driver_fee_usd, driver_fee_lbp 
         FROM orders 
         WHERE driver_id = $1 
         AND (status = $2 OR status = $3)
         AND (payment_status = $4 OR payment_status = $5)
         AND (accounting_cashed = false OR accounting_cashed IS NULL)
         ORDER BY created_at DESC`,
        [driverId, 'delivered', 'completed', 'paid', 'Paid']
      );
      eligibleOrderIds = ordersResult.rows.map(r => r.id);
    }
    
    if (eligibleOrderIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No eligible orders found for cashout'
      });
    }
    
    // Calculate total driver fees from orders if not provided
    let totalUsd = amount_usd || 0;
    let totalLbp = amount_lbp || 0;
    
    if (!amount_usd && !amount_lbp && eligibleOrderIds.length > 0) {
      const ordersResult = await client.query(
        `SELECT SUM(driver_fee_usd) as total_usd, SUM(driver_fee_lbp) as total_lbp 
         FROM orders 
         WHERE id = ANY($1)`,
        [eligibleOrderIds]
      );
      if (ordersResult.rows[0]) {
        totalUsd = Number(ordersResult.rows[0].total_usd || 0);
        totalLbp = Number(ordersResult.rows[0].total_lbp || 0);
      }
    }
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    // Process driver cashout using atomic operations
    await processDriverCashout(client, {
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      driver_id: driverId,
      order_ids: eligibleOrderIds,
      userId: req.user.id,
      description: description || `Driver cashout for ${driver.full_name || driverId}: ${totalUsd} USD / ${totalLbp} LBP`
    });
    
    await client.query('COMMIT');
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('cashbox-update', {
        driverId: driverId,
        action: 'driver_cashout'
      });
      
      io.emit('accounting-update', {
        driverId: driverId,
        action: 'cashout'
      });
    }
    
    res.json({
      success: true,
      message: 'Driver cashout processed successfully',
      data: {
        driver_id: driverId,
        driver_name: driver.full_name,
        amount_usd: totalUsd,
        amount_lbp: totalLbp,
        order_ids: eligibleOrderIds
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Error processing driver cashout:', {
      message: error.message,
      stack: error.stack,
      driverId: req.params.id,
      userId: req.user?.id,
      errorName: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process driver cashout',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get driver details with orders and balances
router.get('/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;
    
    let whereClause = 'WHERE o.driver_id = ? AND (o.accounting_cashed = false OR o.accounting_cashed IS NULL)';
    const params = [parseInt(id)];
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }
    
    // Get driver info
    const driverResult = await query('SELECT * FROM drivers WHERE id = ?', [id]);
    const driver = driverResult[0] || { full_name: `Driver ${id}`, id: parseInt(id) };
    
    // Get orders for this driver
    const orders = await query(`
      SELECT 
        o.*,
        o.order_ref as reference,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.driver_fee_usd as fee_usd,
        o.driver_fee_lbp as fee_lbp,
        o.created_at as date,
        o.payment_status,
        o.status as order_status,
        o.customer_name,
        o.customer_phone,
        o.customer_address as customer_location
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);
    
    // Calculate summary
    let ordersSumUsd = 0, ordersSumLbp = 0;
    let feesUsd = 0, feesLbp = 0;
    let paymentsUsd = 0, paymentsLbp = 0;
    
    orders.forEach(order => {
      ordersSumUsd += Number(order.price_usd || 0);
      ordersSumLbp += Number(order.price_lbp || 0);
      feesUsd += Number(order.fee_usd || 0);
      feesLbp += Number(order.fee_lbp || 0);
    });
    
    // Get payments (from transactions)
    const payments = await query(`
      SELECT SUM(amount_usd) as total_usd, SUM(amount_lbp) as total_lbp
      FROM transactions
      WHERE actor_type = 'driver' AND actor_id = ? AND tx_type = 'driver_payment'
    `, [driver.id || null]);
    
    if (payments.length > 0 && payments[0].total_usd) {
      paymentsUsd = Number(payments[0].total_usd || 0);
      paymentsLbp = Number(payments[0].total_lbp || 0);
    }
    
    const oldBalanceUsd = Number(driver.old_balance_usd || 0);
    const oldBalanceLbp = Number(driver.old_balance_lbp || 0);
    const newBalanceUsd = oldBalanceUsd + ordersSumUsd + feesUsd - paymentsUsd;
    const newBalanceLbp = oldBalanceLbp + ordersSumLbp + feesLbp - paymentsLbp;
    
    res.json({
      success: true,
      data: {
        driver,
        orders,
        summary: {
          old_balance_usd: oldBalanceUsd,
          old_balance_lbp: oldBalanceLbp,
          orders_sum_usd: ordersSumUsd,
          orders_sum_lbp: ordersSumLbp,
          fees_usd: feesUsd,
          fees_lbp: feesLbp,
          payments_usd: paymentsUsd,
          payments_lbp: paymentsLbp,
          new_balance_usd: newBalanceUsd,
          new_balance_lbp: newBalanceLbp
        }
      }
    });
  } catch (error) {
    console.error('Error fetching driver details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get third-party details with orders and balances
router.get('/third-party/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { fromDate, toDate } = req.query;
    
    let whereClause = 'WHERE o.third_party_name = ?';
    const params = [decodeURIComponent(name)];
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }
    
    // Get orders for this third party
    const orders = await query(`
      SELECT 
        o.*,
        o.order_ref as reference,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.total_usd as order_price_usd,
        o.total_lbp as order_price_lbp,
        o.third_party_fee_usd,
        o.third_party_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.created_at as date,
        o.payment_status,
        o.status as order_status,
        o.customer_name,
        o.customer_address as customer_location,
        d.full_name as driver_name,
        COALESCE(c.business_name, o.brand_name, 'Unknown Client') as client_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);
    
    // Calculate summary
    let ordersSumUsd = 0, ordersSumLbp = 0;
    let deliveryFeesUsd = 0, deliveryFeesLbp = 0;
    let thirdPartyFeesUsd = 0, thirdPartyFeesLbp = 0;
    let driverFeesUsd = 0, driverFeesLbp = 0;
    let paymentsUsd = 0, paymentsLbp = 0;
    
    orders.forEach(order => {
      ordersSumUsd += Number(order.price_usd || 0);
      ordersSumLbp += Number(order.price_lbp || 0);
      deliveryFeesUsd += Number(order.delivery_fee_usd || 0);
      deliveryFeesLbp += Number(order.delivery_fee_lbp || 0);
      thirdPartyFeesUsd += Number(order.third_party_fee_usd || 0);
      thirdPartyFeesLbp += Number(order.third_party_fee_lbp || 0);
      driverFeesUsd += Number(order.driver_fee_usd || 0);
      driverFeesLbp += Number(order.driver_fee_lbp || 0);
    });
    
    // Get payments (from transactions)
    const payments = await query(`
      SELECT SUM(amount_usd) as total_usd, SUM(amount_lbp) as total_lbp
      FROM transactions
      WHERE actor_type = 'third_party' AND actor_id = ? AND tx_type = 'third_party_payment'
    `, [name]);
    
    if (payments.length > 0 && payments[0].total_usd) {
      paymentsUsd = Number(payments[0].total_usd || 0);
      paymentsLbp = Number(payments[0].total_lbp || 0);
    }
    
    const totalValueUsd = ordersSumUsd + deliveryFeesUsd + thirdPartyFeesUsd;
    const totalValueLbp = ordersSumLbp + deliveryFeesLbp + thirdPartyFeesLbp;
    
    res.json({
      success: true,
      data: {
        thirdParty: { name: decodeURIComponent(name) },
        orders,
        summary: {
          orders_sum_usd: ordersSumUsd,
          orders_sum_lbp: ordersSumLbp,
          delivery_fees_usd: deliveryFeesUsd,
          delivery_fees_lbp: deliveryFeesLbp,
          third_party_fees_usd: thirdPartyFeesUsd,
          third_party_fees_lbp: thirdPartyFeesLbp,
          driver_fees_usd: driverFeesUsd,
          driver_fees_lbp: driverFeesLbp,
          payments_usd: paymentsUsd,
          payments_lbp: paymentsLbp,
          total_value_usd: totalValueUsd,
          total_value_lbp: totalValueLbp
        }
      }
    });
  } catch (error) {
    console.error('Error fetching third-party details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get client details with orders and balances
router.get('/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;
    
    let whereClause = 'WHERE (o.accounting_cashed = false OR o.accounting_cashed IS NULL) AND o.cashbox_history_moved = false';
    const params = [];
    
    // Determine if id is numeric (client_id) or string (brand_name)
    const isNumeric = !isNaN(parseInt(id));
    if (isNumeric) {
      whereClause += ' AND o.client_id = ?';
      params.push(parseInt(id));
    } else {
      whereClause += ' AND (c.business_name = ? OR o.brand_name = ?)';
      params.push(id, id);
    }
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }
    
    // Get client info
    const clientQuery = isNumeric 
      ? 'SELECT * FROM clients WHERE id = ?'
      : 'SELECT * FROM clients WHERE business_name = ? LIMIT 1';
    const clientResult = await query(clientQuery, [id]);
    const client = clientResult[0] || { business_name: id };
    
    // Get orders for this client
    const orders = await query(`
      SELECT 
        o.*,
        o.order_ref as reference,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.delivery_fee_usd as fee_usd,
        o.delivery_fee_lbp as fee_lbp,
        o.created_at as date,
        o.payment_status,
        o.status as order_status
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);
    
    // Calculate summary
    let ordersSumUsd = 0, ordersSumLbp = 0;
    let feesUsd = 0, feesLbp = 0;
    let paymentsUsd = 0, paymentsLbp = 0;
    
    orders.forEach(order => {
      ordersSumUsd += Number(order.price_usd || 0);
      ordersSumLbp += Number(order.price_lbp || 0);
      feesUsd += Number(order.fee_usd || 0);
      feesLbp += Number(order.fee_lbp || 0);
    });
    
    // Get payments (from transactions)
    const payments = await query(`
      SELECT SUM(amount_usd) as total_usd, SUM(amount_lbp) as total_lbp
      FROM transactions
      WHERE actor_type = 'client' AND actor_id = ? AND tx_type = 'client_payment'
    `, [client.id || null]);
    
    if (payments.length > 0) {
      paymentsUsd = Number(payments[0].total_usd || 0);
      paymentsLbp = Number(payments[0].total_lbp || 0);
    }
    
    const oldBalanceUsd = Number(client.old_balance_usd || 0);
    const oldBalanceLbp = Number(client.old_balance_lbp || 0);
    const newBalanceUsd = oldBalanceUsd + ordersSumUsd - feesUsd - paymentsUsd;
    const newBalanceLbp = oldBalanceLbp + ordersSumLbp - feesLbp - paymentsLbp;
    
    res.json({
      success: true,
      data: {
        client,
        orders,
        summary: {
          old_balance_usd: oldBalanceUsd,
          old_balance_lbp: oldBalanceLbp,
          orders_sum_usd: ordersSumUsd,
          orders_sum_lbp: ordersSumLbp,
          fees_usd: feesUsd,
          fees_lbp: feesLbp,
          payments_usd: paymentsUsd,
          payments_lbp: paymentsLbp,
          new_balance_usd: newBalanceUsd,
          new_balance_lbp: newBalanceLbp
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process client cashout
router.post('/clients/:id/cashout', authenticateToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { amount_usd, amount_lbp, order_ids = [], description } = req.body;
    
    // Determine if id is numeric (client_id) or string (brand_name/client name)
    const isNumeric = !isNaN(parseInt(id));
    let clientId = null;
    let clientName = id;
    
    if (isNumeric) {
      clientId = parseInt(id);
      const clientResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0) {
        clientName = clientResult.rows[0].business_name;
      }
    } else {
      // Look up client by business_name
      const clientResult = await client.query('SELECT * FROM clients WHERE business_name = $1 LIMIT 1', [id]);
      if (clientResult.rows.length > 0) {
        clientId = clientResult.rows[0].id;
        clientName = clientResult.rows[0].business_name;
      }
    }
    
    // If no order_ids provided, find eligible orders for this client
    let eligibleOrderIds = order_ids;
    if (eligibleOrderIds.length === 0) {
      const ordersQuery = isNumeric
        ? 'SELECT id FROM orders WHERE client_id = $1 AND cashbox_history_moved = false AND status = $2 AND payment_status = $3'
        : 'SELECT id FROM orders WHERE brand_name = $1 AND cashbox_history_moved = false AND status = $2 AND payment_status = $3';
      const ordersResult = await client.query(ordersQuery, [id, 'delivered', 'paid']);
      eligibleOrderIds = ordersResult.rows.map(r => r.id);
    }
    
    if (eligibleOrderIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No eligible orders found for cashout'
      });
    }
    
    // Calculate total amount from orders if not provided
    let totalUsd = amount_usd || 0;
    let totalLbp = amount_lbp || 0;
    
    if (!amount_usd && !amount_lbp && eligibleOrderIds.length > 0) {
      const ordersResult = await client.query(
        `SELECT SUM(total_usd) as total_usd, SUM(total_lbp) as total_lbp 
         FROM orders WHERE id = ANY($1)`,
        [eligibleOrderIds]
      );
      if (ordersResult.rows[0]) {
        totalUsd = Number(ordersResult.rows[0].total_usd || 0);
        totalLbp = Number(ordersResult.rows[0].total_lbp || 0);
      }
    }
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    // Process cashout using atomic operations
    await processClientCashout(client, {
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      client_id: clientId,
      order_ids: eligibleOrderIds,
      userId: req.user.id,
      description: description || `Client cashout for ${clientName || id}`
    });
    
    await client.query('COMMIT');
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('cashbox-update', {
        orderRef: null,
        action: 'client_cashout'
      });
      
      io.emit('accounting-update', {
        clientId: clientId,
        action: 'cashout'
      });
    }
    
    res.json({
      success: true,
      message: 'Client cashout processed successfully',
      data: {
        client_id: clientId,
        client_name: clientName,
        amount_usd: totalUsd,
        amount_lbp: totalLbp,
        order_ids: eligibleOrderIds
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Error processing client cashout:', {
      message: error.message,
      stack: error.stack,
      clientId: req.params.id,
      userId: req.user?.id,
      errorName: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process client cashout',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Record payment (supports add/remove from cash account for all account types)
router.post('/payments', authenticateToken, async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(500).json({
      success: false,
      message: 'Database connection not available'
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      order_id, 
      account_type, 
      account_id, 
      amount_usd = 0, 
      amount_lbp = 0, 
      payment_method = 'cash',
      notes = '',
      action = 'add' // 'add' or 'remove' - determines if money is added to or removed from cash account
    } = req.body;
    
    if (!order_id || !account_type || !account_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'order_id, account_type, and account_id are required'
      });
    }
    
    if (!amount_usd && !amount_lbp) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'At least one amount (USD or LBP) is required'
      });
    }
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    // Get exchange rate for currency conversion
    const { getExchangeRate } = require('../utils/cashboxAtomicOperations');
    const exchangeRate = await getExchangeRate();
    
    // Compute amounts in both currencies
    let finalUsd = Number(amount_usd || 0);
    let finalLbp = Number(amount_lbp || 0);
    
    if (finalUsd > 0 && finalLbp === 0) {
      finalLbp = Math.round(finalUsd * exchangeRate);
    } else if (finalLbp > 0 && finalUsd === 0) {
      finalUsd = Math.round((finalLbp / exchangeRate) * 100) / 100;
    }
    
    // Get order details
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orderResult.rows[0];
    
    // Determine cashbox delta based on action
    // 'add' = money goes TO cash account (positive delta)
    // 'remove' = money goes FROM cash account (negative delta)
    const cashDeltaUsd = action === 'add' ? finalUsd : -finalUsd;
    const cashDeltaLbp = action === 'add' ? finalLbp : -finalLbp;
    
    // Update cashbox balances
    const cashboxOps = require('../utils/cashboxAtomicOperations');
    await cashboxOps.updateCashboxBalances(client, cashDeltaUsd, cashDeltaLbp, 'cash');
    
    // Create cashbox entry
    const entryDescription = action === 'add'
      ? `Payment added to cash account - ${finalUsd} USD / ${finalLbp} LBP (${account_type} payment for order ${order.order_ref || order_id})`
      : `Payment removed from cash account - ${finalUsd} USD / ${finalLbp} LBP (${account_type} payment for order ${order.order_ref || order_id})`;
    
    await cashboxOps.createCashboxEntry(client, {
      entry_type: action === 'add' ? 'cash_in' : 'cash_out',
      amount_usd: finalUsd,
      amount_lbp: finalLbp,
      actor_type: account_type,
      actor_id: account_id,
      order_id: order_id,
      description: `${notes ? notes + ' - ' : ''}${entryDescription}`,
      account_type: 'cash',
      created_by: req.user.id
    });
    
    // Create accounting transaction
    const txDescription = `${account_type} payment - ${action === 'add' ? 'Added' : 'Removed'} ${finalUsd} USD / ${finalLbp} LBP ${action === 'add' ? 'to' : 'from'} cash account`;
    
    await cashboxOps.createTransaction(client, {
      tx_type: `${account_type}_payment`,
      amount_usd: finalUsd,
      amount_lbp: finalLbp,
      actor_type: account_type,
      actor_id: account_id,
      order_id: order_id,
      debit_account: action === 'add' ? `${account_type}_payable` : 'cash_account',
      credit_account: action === 'add' ? 'cash_account' : `${account_type}_payable`,
      description: `${notes ? notes + ' - ' : ''}${txDescription}`,
      created_by: req.user.id
    });
    
    // Update order amounts if action is 'remove'
    // When removing from cash account, we also remove from the order's balance
    if (action === 'remove') {
      // Calculate amounts to subtract from order
      const orderTotalUsd = Number(order.total_usd || 0);
      const orderTotalLbp = Number(order.total_lbp || 0);
      
      // Subtract the payment amount from order totals (but don't go negative)
      const newTotalUsd = Math.max(0, orderTotalUsd - finalUsd);
      const newTotalLbp = Math.max(0, orderTotalLbp - finalLbp);
      
      await client.query(
        `UPDATE orders SET total_usd = $1, total_lbp = $2, updated_at = NOW() WHERE id = $3`,
        [newTotalUsd, newTotalLbp, order_id]
      );
      
      console.log(`✅ Order ${order_id} updated: Removed ${finalUsd} USD / ${finalLbp} LBP from order totals`);
    }
    
    await client.query('COMMIT');
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('payment-update', {
        orderId: order_id,
        accountType: account_type,
        accountId: account_id,
        amount_usd: finalUsd,
        amount_lbp: finalLbp,
        action: action
      });
      
      io.emit('cashbox-update', {
        orderRef: order.order_ref,
        action: action === 'add' ? 'payment_added' : 'payment_removed'
      });
    }
    
    res.json({
      success: true,
      message: `Payment ${action === 'add' ? 'added to' : 'removed from'} cash account successfully`,
      data: {
        order_id: order_id,
        account_type: account_type,
        account_id: account_id,
        amount_usd: finalUsd,
        amount_lbp: finalLbp,
        action: action
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Record client payment (legacy endpoint - kept for backward compatibility)
router.post('/clients/:id/pay', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd, amount_lbp, description, payment_method } = req.body;
    
    if (!amount_usd && !amount_lbp) {
      return res.status(400).json({
        success: false,
        message: 'Amount in USD or LBP is required'
      });
    }
    
    // Determine if id is numeric or string
    const isNumeric = !isNaN(parseInt(id));
    const clientId = isNumeric ? parseInt(id) : null;
    
    // Get exchange rate
    const rate = await getExchangeRate();
    
    let finalUsd = Number(amount_usd || 0);
    let finalLbp = Number(amount_lbp || 0);
    
    // Compute missing currency
    if (finalUsd > 0 && finalLbp === 0) {
      finalLbp = Math.round(finalUsd * rate);
    } else if (finalLbp > 0 && finalUsd === 0) {
      finalUsd = Math.round((finalLbp / rate) * 100) / 100;
    }
    
    // Create transaction
    await run(
      `INSERT INTO transactions (tx_type, amount_usd, amount_lbp, actor_type, actor_id, 
       debit_account, credit_account, description, created_by, created_at)
       VALUES (?, ?, ?, 'client', ?, 'cash_account', 'client_receivable', ?, ?, now())`,
      ['client_payment', finalUsd, finalLbp, clientId, description || 'Client payment', req.user.id]
    );
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('payment-update', {
        clientId: clientId,
        amount_usd: finalUsd,
        amount_lbp: finalLbp
      });
    }
    
    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        amount_usd: finalUsd,
        amount_lbp: finalLbp
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
});

// Export client accounting orders to PDF
router.get('/clients/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;
    
    // Determine if id is numeric (client ID) or string (brand name)
    const isNumeric = !isNaN(parseInt(id));
    
    // Build where clause
    let whereClause = 'WHERE (o.moved_to_history IS NULL OR o.moved_to_history = false)';
    const params = [];
    
    if (isNumeric) {
      whereClause += ' AND o.client_id = ?';
      params.push(parseInt(id));
    } else {
      whereClause += ' AND (c.business_name = ? OR o.brand_name = ?)';
      params.push(id, id);
    }
    
    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(toDate);
    }
    
    // Get client info
    const clientQuery = isNumeric 
      ? 'SELECT * FROM clients WHERE id = ?'
      : 'SELECT * FROM clients WHERE business_name = ? LIMIT 1';
    const clientResult = await query(clientQuery, [id]);
    const client = clientResult[0] || { business_name: id };
    const clientName = client.business_name || id;
    
    // Get orders for this client
    const orders = await query(`
      SELECT 
        o.id,
        o.order_ref as reference,
        o.type as order_type,
        o.customer_name,
        o.customer_phone,
        o.customer_address as customer_location,
        o.total_usd as price_usd,
        o.total_lbp as price_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.third_party_fee_usd,
        o.third_party_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.payment_status,
        o.status as order_status,
        o.created_at as date,
        o.notes,
        d.full_name as driver_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `, params);
    
    // Generate PDF using pdfkit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    const exportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).text(`Account: ${clientName}`, { align: 'center' });
    doc.fontSize(12).text(`Export Date: ${exportDate}`, { align: 'center' });
    doc.moveDown(2);
    
    // Summary section
    let totalOrdersUsd = 0;
    let totalOrdersLbp = 0;
    let totalFeesUsd = 0;
    let totalFeesLbp = 0;
    
    orders.forEach(order => {
      totalOrdersUsd += Number(order.price_usd || 0);
      totalOrdersLbp += Number(order.price_lbp || 0);
      totalFeesUsd += Number(order.delivery_fee_usd || 0);
      totalFeesLbp += Number(order.delivery_fee_lbp || 0);
    });
    
    // Calculate new balance (ecommerce: orders - fees, instant: orders + fees)
    let ecommerceOrdersUsd = 0, ecommerceOrdersLbp = 0, ecommerceFeesUsd = 0, ecommerceFeesLbp = 0;
    let instantOrdersUsd = 0, instantOrdersLbp = 0, instantFeesUsd = 0, instantFeesLbp = 0;
    
    orders.forEach(order => {
      const orderType = String(order.order_type || '').toLowerCase().trim();
      if (orderType === 'ecommerce') {
        ecommerceOrdersUsd += Number(order.price_usd || 0);
        ecommerceOrdersLbp += Number(order.price_lbp || 0);
        ecommerceFeesUsd += Number(order.delivery_fee_usd || 0);
        ecommerceFeesLbp += Number(order.delivery_fee_lbp || 0);
      } else if (orderType === 'instant') {
        instantOrdersUsd += Number(order.price_usd || 0);
        instantOrdersLbp += Number(order.price_lbp || 0);
        instantFeesUsd += Number(order.delivery_fee_usd || 0);
        instantFeesLbp += Number(order.delivery_fee_lbp || 0);
      }
    });
    
    const ecommerceBalanceUsd = ecommerceOrdersUsd - ecommerceFeesUsd;
    const ecommerceBalanceLbp = ecommerceOrdersLbp - ecommerceFeesLbp;
    const instantBalanceUsd = instantOrdersUsd + instantFeesUsd;
    const instantBalanceLbp = instantOrdersLbp + instantFeesLbp;
    const otherOrdersUsd = totalOrdersUsd - ecommerceOrdersUsd - instantOrdersUsd;
    const otherOrdersLbp = totalOrdersLbp - ecommerceOrdersLbp - instantOrdersLbp;
    const otherFeesUsd = totalFeesUsd - ecommerceFeesUsd - instantFeesUsd;
    const otherFeesLbp = totalFeesLbp - ecommerceFeesLbp - instantFeesLbp;
    const otherBalanceUsd = otherOrdersUsd + otherFeesUsd;
    const otherBalanceLbp = otherOrdersLbp + otherFeesLbp;
    
    const newBalanceUsd = ecommerceBalanceUsd + instantBalanceUsd + otherBalanceUsd;
    const newBalanceLbp = ecommerceBalanceLbp + instantBalanceLbp + otherBalanceLbp;
    
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Orders: ${orders.length}`);
    doc.text(`Orders Sum (USD): $${totalOrdersUsd.toFixed(2)}`);
    doc.text(`Orders Sum (LBP): ${totalOrdersLbp.toLocaleString()}`);
    doc.text(`Total Fees (USD): $${totalFeesUsd.toFixed(2)}`);
    doc.text(`Total Fees (LBP): ${totalFeesLbp.toLocaleString()}`);
    doc.text(`New Balance (USD): $${newBalanceUsd.toFixed(2)}`);
    doc.text(`New Balance (LBP): ${newBalanceLbp.toLocaleString()}`);
    doc.moveDown();
    
    // Orders table
    doc.fontSize(14).text('Orders Details', { underline: true });
    doc.moveDown(0.5);
    
    // Table headers
    const tableTop = doc.y;
    const itemHeight = 20;
    let y = tableTop;
    
    doc.fontSize(8);
    doc.text('Ref', 50, y);
    doc.text('Type', 120, y);
    doc.text('Customer', 180, y);
    doc.text('Total USD', 280, y);
    doc.text('Total LBP', 350, y);
    doc.text('Fee USD', 430, y);
    doc.text('Fee LBP', 490, y);
    doc.text('Status', 560, y);
    y += itemHeight;
    
    // Draw line
    doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();
    
    // Orders rows
    orders.forEach((order, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.text(order.reference || '', 50, y, { width: 60 });
      doc.text(order.order_type || '', 120, y, { width: 50 });
      doc.text(order.customer_name || '', 180, y, { width: 90 });
      doc.text(`$${Number(order.price_usd || 0).toFixed(2)}`, 280, y, { width: 60 });
      doc.text(Number(order.price_lbp || 0).toLocaleString(), 350, y, { width: 70 });
      doc.text(`$${Number(order.delivery_fee_usd || 0).toFixed(2)}`, 430, y, { width: 50 });
      doc.text(Number(order.delivery_fee_lbp || 0).toLocaleString(), 490, y, { width: 60 });
      doc.text(order.order_status || '', 560, y, { width: 60 });
      
      y += itemHeight;
      
      // Draw line between rows
      if (index < orders.length - 1) {
        doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();
      }
    });
    
    // Footer
    doc.fontSize(10);
    doc.text(`Generated on ${exportDate}`, 50, doc.page.height - 50);
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error exporting client accounting to PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export PDF',
      error: error.message
    });
  }
});

module.exports = router;