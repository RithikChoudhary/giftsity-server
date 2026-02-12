/**
 * Vercel Serverless Entry Point for Giftsity Corporate Server
 *
 * This wraps the Express app as a serverless function.
 * All /api/corporate/* requests are routed here via vercel.json.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('../../server/config/db');

const app = express();
app.set('trust proxy', 1);

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
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/corporate/auth', require('../../server-corporate/routes/auth'));
app.use('/api/corporate/catalog', require('../../server-corporate/routes/catalog'));
app.use('/api/corporate/orders', require('../../server-corporate/routes/orders'));
app.use('/api/corporate/quotes', require('../../server-corporate/routes/quotes'));
app.use('/api/corporate/inquiries', require('../../server-corporate/routes/inquiries'));

// Health check
app.get('/api/corporate/health', (req, res) => res.json({ status: 'ok', service: 'giftsity-corporate-vercel' }));

// 404
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Corporate Vercel Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Reuse DB connection across warm invocations
let dbConnected = false;

module.exports = async (req, res) => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
  return app(req, res);
};
