const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const PortManager = require('./utils/portManager');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const crmRoutes = require('./routes/crm');
const ordersRoutes = require('./routes/orders');
const ordersBatchRoutes = require('./routes/ordersBatch');
const orderHistoryRoutes = require('./routes/orderHistory');
const driversRoutes = require('./routes/drivers');
const accountingRoutes = require('./routes/accounting');
const accountingEnhancedRoutes = require('./routes/accountingEnhanced');
const cashboxRoutes = require('./routes/cashbox');
const priceListRoutes = require('./routes/priceList');
const transactionsRoutes = require('./routes/transactions');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const deliveryPricesRoutes = require('./routes/deliveryPrices');
const paymentsRoutes = require('./routes/payments');
const clientAccountsRoutes = require('./routes/clientAccounts');
const priceImportRoutes = require('./routes/priceImport');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const fs = require('fs');
const path = require('path');
const mcp = require('./mcp');

// Define allowed origins for both CORS and Socket.IO
function parseEnvOrigins() {
  const list = [];
  const vars = [process.env.FRONTEND_URL, process.env.CLIENT_URL];
  for (const val of vars) {
    if (!val) continue;
    const parts = String(val)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    list.push(...parts);
  }
  return Array.from(new Set(list));
}

const allowedOrigins = [
  ...parseEnvOrigins(),
  "http://localhost:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5175",
  "https://runners-lb.vercel.app"
];

console.log('🌐 CORS allowed origins:', allowedOrigins);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Normalize origin (strip trailing slash)
    const normalized = origin.replace(/\/$/, '');

    // Check if origin is in allowed list
    if (allowedOrigins.some(o => o.replace(/\/$/, '') === normalized)) {
      return callback(null, true);
    }

    // Allow localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// Ensure preflight requests are handled for all routes
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add cookie-parser for JWT tokens in cookies
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('auth', (userId) => {
    if (userId) {
      const room = `user-${userId}`;
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
    }
  });

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Health checks - always 200 and lowercase status per contract
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Health check (for client)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/crm', authenticateToken, crmRoutes);
app.use('/api/clients', authenticateToken, crmRoutes); // Add alias for clients endpoint
app.use('/api/orders', authenticateToken, ordersRoutes);
app.use('/api/orders/batch', authenticateToken, ordersBatchRoutes);
app.use('/api/orders/history', authenticateToken, orderHistoryRoutes); // Add alias for order history
app.use('/api/order-history', authenticateToken, orderHistoryRoutes);
app.use('/api/drivers', authenticateToken, driversRoutes);
app.use('/api/accounting', authenticateToken, accountingRoutes);
app.use('/api/accounting', authenticateToken, accountingEnhancedRoutes);
app.use('/api/cashbox', authenticateToken, cashboxRoutes);
app.use('/api/price-list', authenticateToken, priceListRoutes);
app.use('/api/transactions', authenticateToken, transactionsRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/delivery-prices', authenticateToken, deliveryPricesRoutes);
app.use('/api/payments', authenticateToken, paymentsRoutes);
app.use('/api/client-accounts', authenticateToken, clientAccountsRoutes);
app.use('/api/price-import', authenticateToken, priceImportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Initialize port manager and start server
const startServer = async () => {
  try {
    const portManager = new PortManager();
    const availablePort = await portManager.getAvailablePort(PORT, true); // Try to kill existing process first

    // Kick off MCP readiness check but don't block server start
    (async () => {
      try {
        console.log('🧠 Checking MCP Layer/database readiness in background...');
        await mcp.ensureReady();
        console.log('✅ MCP Layer confirmed database readiness');
      } catch (err) {
        console.error('❌ MCP initialization failed (non-blocking):', err.message);
        console.error('👉 Check DATABASE_URL, credentials, SSL settings, and Neon project status.');
      }
    })();

    server.listen(availablePort, () => {
      console.log(`🚀 Soufian ERP Server running on port ${availablePort}`);
      console.log(`📱 Socket.IO server initialized`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
      
      // Update CORS origin if port changed
      if (availablePort !== PORT) {
        console.log(`⚠️  Server started on different port. Update CORS if needed.`);
      }

      // Write chosen port to a file for test runners/tools
      try {
        const portFile = process.env.SOUFIAN_PORT_FILE || path.join(__dirname, '.server-port');
        fs.writeFileSync(portFile, String(availablePort), 'utf8');
      } catch (e) {
        console.warn('⚠️  Could not write server port file:', e.message);
      }
    });

    // Enhanced error handling
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${availablePort} is already in use.`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🔄 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🔄 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
