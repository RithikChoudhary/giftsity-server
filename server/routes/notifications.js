const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

router.use(requireAuth);

// GET /api/notifications -- list notifications for current user (paginated)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter)
    ]);

    res.json({ notifications, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[Notifications] List error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ count });
  } catch (err) {
    logger.error('[Notifications] Unread count error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notifications/:id/read -- mark a single notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    logger.error('[Notifications] Mark read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notifications/read-all -- mark all as read for current user
router.put('/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (err) {
    logger.error('[Notifications] Mark all read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
