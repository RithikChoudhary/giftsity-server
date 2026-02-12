require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('./config/db');

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
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));

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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', platform: 'Giftsity' }));

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Graceful error handling
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});

// Start
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Giftsity server running on port ${PORT}`);
    // Start cron jobs after server is up
    const { startCronJobs } = require('./cron/sellerHealth');
    startCronJobs();
  });
});
