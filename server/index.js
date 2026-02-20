require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { initSocket } = require('./socket');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// CORS must run before helmet so preflight OPTIONS requests get proper headers
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS not allowed'));
  },
  credentials: true
}));

// Security headers (API-friendly: disable CSP and embedder policy)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Compression
app.use(compression());
// Capture raw body for Cashfree webhook signature verification
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method, url: req.originalUrl, status: res.statusCode, duration,
      ip: req.ip, userAgent: (req.headers['user-agent'] || '').substring(0, 100)
    });
  });
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
// Seller routes moved to server-seller/ (port 5001)
// app.use('/api/seller', require('./routes/seller'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/b2b', require('./routes/b2b'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/store', require('./routes/store'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tracking', require('./routes/shiprocket'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/pincode', require('./routes/pincodeCheck'));

app.use('/api', require('./routes/sitemap'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', platform: 'Giftsity' }));

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack, status: err.status });
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Graceful error handling
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', { error: err?.message || err, stack: err?.stack });
});

// Start
connectDB().then(() => {
  const server = http.createServer(app);

  // Attach Socket.io to the HTTP server
  initSocket(server, allowedOrigins);
  console.log('[Startup] Socket.io initialized');

  server.listen(PORT, () => {
    console.log(`[Startup] Giftsity server running on port ${PORT}`);
    logger.info(`Giftsity server running on port ${PORT}`);
    // Start cron jobs after server is up
    const { startCronJobs } = require('./cron/sellerHealth');
    startCronJobs();
    console.log('[Startup] Cron jobs scheduled');
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      mongoose.connection.close(false).then(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
    setTimeout(() => { process.exit(1); }, 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
