require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', platform: 'Giftsity' }));

// Start
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Giftsity server running on port ${PORT}`);
    // Start cron jobs after server is up
    const { startCronJobs } = require('./cron/sellerHealth');
    startCronJobs();
  });
});
