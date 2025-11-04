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
const priceListRoutes = require('./routes/priceList');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const deliveryPricesRoutes = require('./routes/deliveryPrices');
const priceImportRoutes = require('./routes/priceImport');
const cashboxRoutes = require('./routes/cashbox');
const transactionsRoutes = require('./routes/transactions');
const accountingRoutes = require('./routes/accounting');
const customersRoutes = require('./routes/customers');
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
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176"
];

function isDevLocalhost(origin) {
  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return process.env.NODE_ENV !== 'production' && isLocalHost;
  } catch {
    return false;
  }
}

console.log('🌐 CORS allowed origins:', allowedOrigins);

// Socket.IO with strict CORS and connection limits
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.some(o => o.replace(/\/$/, '') === normalized) || isDevLocalhost(origin);
      if (isAllowed) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "idempotency-key"]
  },
  // Connection limits and timeouts
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 10000, // 10 seconds
  allowEIO3: true,
  // Rate limiting for connections
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  // Connection state management
  serveClient: false,
  // Memory management
  destroyUpgrade: true,
  destroyUpgradeTimeout: 1000
});

// Rate limiting (configurable via env for local testing)
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 1000); // Increased for development
const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check specific rate limiting (more lenient)
const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for health checks
  message: 'Health check rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.some(o => o.replace(/\/$/, '') === normalized) || isDevLocalhost(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'idempotency-key'],
  exposedHeaders: ['Set-Cookie']
}));

// Ensure preflight requests are handled for all routes
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.some(o => o.replace(/\/$/, '') === normalized) || isDevLocalhost(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'idempotency-key'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add cookie-parser for JWT tokens in cookies
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Socket.IO connection handling
// WebSocket connection management
const connectedClients = new Map();
const clientPingTimeouts = new Map();
const MAX_CONNECTIONS = 100; // Maximum concurrent connections
const CONNECTION_RATE_LIMIT = 10; // Max connections per minute per IP
const connectionAttempts = new Map();

io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  const now = Date.now();
  
  // Check connection limits
  if (connectedClients.size >= MAX_CONNECTIONS) {
    console.log(`Connection rejected: Max connections (${MAX_CONNECTIONS}) reached`);
    socket.emit('error', { message: 'Server at capacity, please try again later' });
    socket.disconnect(true);
    return;
  }
  
  // Rate limiting per IP
  if (!connectionAttempts.has(clientIP)) {
    connectionAttempts.set(clientIP, []);
  }
  
  const attempts = connectionAttempts.get(clientIP);
  const recentAttempts = attempts.filter(time => now - time < 60000); // Last minute
  
  if (recentAttempts.length >= CONNECTION_RATE_LIMIT) {
    console.log(`Connection rejected: Rate limit exceeded for IP ${clientIP}`);
    socket.emit('error', { message: 'Too many connection attempts, please wait' });
    socket.disconnect(true);
    return;
  }
  
  attempts.push(now);
  connectionAttempts.set(clientIP, attempts);
  
  console.log(`Client connected: ${socket.id} from ${clientIP}`);
  
  // Track connected client
  connectedClients.set(socket.id, {
    id: socket.id,
    connectedAt: now,
    lastPing: now,
    userId: null,
    rooms: new Set(),
    ip: clientIP
  });

  // Set up ping/pong for keep-alive
  const pingTimeout = setTimeout(() => {
    console.log(`Client ${socket.id} ping timeout, disconnecting`);
    socket.disconnect(true);
  }, 60000); // 60 second timeout

  clientPingTimeouts.set(socket.id, pingTimeout);

  // Handle ping from client
  socket.on('ping', (timestamp) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastPing = Date.now();
      // Reset ping timeout
      clearTimeout(clientPingTimeouts.get(socket.id));
      const newTimeout = setTimeout(() => {
        console.log(`Client ${socket.id} ping timeout, disconnecting`);
        socket.disconnect(true);
      }, 60000);
      clientPingTimeouts.set(socket.id, newTimeout);
    }
    socket.emit('pong', timestamp);
  });

  // Handle authentication
  socket.on('auth', (userId) => {
    if (userId) {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.userId = userId;
        const room = `user-${userId}`;
        socket.join(room);
        client.rooms.add(room);
        console.log(`Client ${socket.id} joined room: ${room}`);
      }
    }
  });

  // Handle room joining
  socket.on('join-room', (room) => {
    socket.join(room);
    const client = connectedClients.get(socket.id);
    if (client) {
      client.rooms.add(room);
    }
    console.log(`Client ${socket.id} joined room: ${room}`);
  });

  // Handle room leaving
  socket.on('leave-room', (room) => {
    socket.leave(room);
    const client = connectedClients.get(socket.id);
    if (client) {
      client.rooms.delete(room);
    }
    console.log(`Client ${socket.id} left room: ${room}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`WebSocket error for client ${socket.id}:`, error);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    
    // Clean up client data
    const client = connectedClients.get(socket.id);
    if (client) {
      console.log(`Client ${socket.id} was connected for ${Date.now() - client.connectedAt}ms`);
    }
    
    // Clear ping timeout
    const timeout = clientPingTimeouts.get(socket.id);
    if (timeout) {
      clearTimeout(timeout);
      clientPingTimeouts.delete(socket.id);
    }
    
    // Remove from connected clients
    connectedClients.delete(socket.id);
  });

  // Send initial connection confirmation
  socket.emit('connected', { 
    id: socket.id, 
    timestamp: Date.now(),
    serverTime: new Date().toISOString()
  });
});

// Periodic cleanup of stale connections and rate limiting data
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  // Clean up stale clients
  for (const [socketId, client] of connectedClients.entries()) {
    if (now - client.lastPing > staleThreshold) {
      console.log(`Cleaning up stale client: ${socketId}`);
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
      connectedClients.delete(socketId);
      const timeout = clientPingTimeouts.get(socketId);
      if (timeout) {
        clearTimeout(timeout);
        clientPingTimeouts.delete(socketId);
      }
    }
  }
  
  // Clean up old connection attempts (older than 5 minutes)
  for (const [ip, attempts] of connectionAttempts.entries()) {
    const recentAttempts = attempts.filter(time => now - time < 5 * 60 * 1000);
    if (recentAttempts.length === 0) {
      connectionAttempts.delete(ip);
    } else {
      connectionAttempts.set(ip, recentAttempts);
    }
  }
  
  // Log connection stats
  console.log(`WebSocket stats: ${connectedClients.size} connected, ${connectionAttempts.size} IPs tracked`);
}, 60000); // Check every minute

// Make io available to routes
app.set('io', io);

// Health checks - always 200 and lowercase status per contract
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Health check (for client) - with specific rate limiting
app.options('/api/health', (req, res) => {
  // Handle preflight requests
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

app.get('/api/health', healthCheckLimiter, (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Soufian ERP',
    version: '1.0.0'
  });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes); // Make customers public for order creation

// Protected routes
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/crm', authenticateToken, crmRoutes);
app.use('/api/clients', authenticateToken, crmRoutes); // Add alias for clients endpoint
app.use('/api/orders', authenticateToken, ordersRoutes);
app.use('/api/orders/batch', authenticateToken, ordersBatchRoutes);
app.use('/api/orders/history', authenticateToken, orderHistoryRoutes); // Add alias for order history
app.use('/api/order-history', authenticateToken, orderHistoryRoutes);
app.use('/api/drivers', authenticateToken, driversRoutes);
app.use('/api/price-list', authenticateToken, priceListRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/delivery-prices', authenticateToken, deliveryPricesRoutes);
app.use('/api/price-import', authenticateToken, priceImportRoutes);
app.use('/api/cashbox', authenticateToken, cashboxRoutes);
app.use('/api/transactions', authenticateToken, transactionsRoutes);
app.use('/api/accounting', authenticateToken, accountingRoutes);

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
