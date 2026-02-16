const Notification = require('../models/Notification');
const { emitToUser } = require('../socket');
const logger = require('./logger');

/**
 * Create an in-app notification. Saves to DB first, then pushes via Socket.io.
 * @param {Object} opts
 * @param {string} opts.userId - Recipient user ID
 * @param {string} opts.userRole - Recipient role (customer, seller, admin)
 * @param {string} opts.type - Notification type enum
 * @param {string} opts.title - Short title
 * @param {string} opts.message - Longer description
 * @param {string} [opts.link] - Deep link URL (e.g. /orders/abc123)
 * @param {Object} [opts.metadata] - Extra data (orderId, payoutId, etc.)
 */
async function createNotification({ userId, userRole, type, title, message, link, metadata }) {
  try {
    // DB-first: save notification before attempting socket push
    const notification = await Notification.create({
      userId,
      userRole,
      type,
      title,
      message: message || '',
      link: link || '',
      metadata: metadata || {}
    });

    // Best-effort socket push (user may be offline)
    emitToUser(userId.toString(), 'notification', {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      metadata: notification.metadata,
      isRead: false,
      createdAt: notification.createdAt
    });

    return notification;
  } catch (err) {
    // Notification creation should never break the main flow
    logger.error(`[Notify] Failed to create notification: ${err.message}`, { userId, type, title });
    return null;
  }
}

module.exports = { createNotification };
