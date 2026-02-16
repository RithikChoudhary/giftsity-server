const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { findIdentityByToken } = require('./utils/identity');
const logger = require('./utils/logger');

let io = null;

/**
 * Initialize Socket.io on the given HTTP server.
 * Returns the io instance (also accessible via getIO()).
 */
function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const identity = await findIdentityByToken(decoded);
      if (!identity) return next(new Error('Invalid token'));

      socket.userId = identity.entity._id.toString();
      socket.userRole = identity.role;
      socket.userName = identity.entity.name || identity.entity.email || '';
      next();
    } catch (err) {
      logger.warn(`[Socket] Auth failed: ${err.message}`);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for targeted notifications and messages
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);
    logger.info(`[Socket] ${socket.userRole}:${socket.userId} connected (room: ${userRoom})`);

    // ---- Chat Events ----

    // Send a message via socket (alternative to REST POST)
    socket.on('sendMessage', async (data, callback) => {
      try {
        const Conversation = require('./models/Conversation');
        const Message = require('./models/Message');
        const { createNotification } = require('./utils/notify');

        const { conversationId, content, images } = data;
        if (!conversationId || (!content && (!images || !images.length))) {
          return callback?.({ error: 'conversationId and content required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return callback?.({ error: 'Conversation not found' });

        const isParticipant = conversation.participants.some(p => p.userId.toString() === socket.userId);
        if (!isParticipant) return callback?.({ error: 'Not a participant' });

        // DB-first: save before emitting
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: socket.userId,
          senderRole: socket.userRole,
          senderName: socket.userName,
          content: content || '',
          images: images || []
        });

        // Update conversation
        conversation.lastMessage = { content: content || '(image)', senderId: socket.userId, sentAt: message.createdAt };
        const otherParticipant = conversation.participants.find(p => p.userId.toString() !== socket.userId);
        if (otherParticipant) {
          const otherId = otherParticipant.userId.toString();
          const currentCount = conversation.unreadCounts.get(otherId) || 0;
          conversation.unreadCounts.set(otherId, currentCount + 1);

          io.to(`user:${otherId}`).emit('newMessage', {
            conversationId: conversation._id,
            message: {
              _id: message._id,
              senderId: message.senderId,
              senderRole: message.senderRole,
              senderName: message.senderName,
              content: message.content,
              images: message.images,
              createdAt: message.createdAt
            }
          });

          createNotification({
            userId: otherId,
            userRole: otherParticipant.userRole,
            type: 'new_message',
            title: `New message from ${socket.userName || 'Someone'}`,
            message: (content || '(image)').substring(0, 100),
            link: otherParticipant.userRole === 'seller' ? '/seller/chat' : '/chat',
            metadata: { conversationId: conversation._id.toString() }
          });
        }
        await conversation.save();

        callback?.({ success: true, message });
      } catch (err) {
        logger.error(`[Socket] sendMessage error: ${err.message}`);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('markRead', async (data) => {
      try {
        const Conversation = require('./models/Conversation');
        const Message = require('./models/Message');
        const { conversationId } = data;
        if (!conversationId) return;

        // Mark all unread messages from others as read
        await Message.updateMany(
          { conversationId, senderId: { $ne: socket.userId }, readAt: null },
          { readAt: new Date() }
        );

        // Reset unread count
        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCounts.${socket.userId}`]: 0
        });
      } catch (err) {
        logger.error(`[Socket] markRead error: ${err.message}`);
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('userTyping', { conversationId, userId: socket.userId, userName: socket.userName });
      }
    });

    socket.on('stopTyping', (data) => {
      const { conversationId, recipientId } = data;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('userStopTyping', { conversationId, userId: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] ${socket.userRole}:${socket.userId} disconnected`);
    });
  });

  logger.info('[Socket] Socket.io initialized');
  return io;
}

/**
 * Get the Socket.io instance. Returns null if not yet initialized.
 */
function getIO() {
  return io;
}

/**
 * Emit an event to a specific user's room.
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitToUser };
