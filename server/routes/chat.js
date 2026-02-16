const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Seller = require('../models/Seller');
const { requireAuth } = require('../middleware/auth');
const { emitToUser } = require('../socket');
const { createNotification } = require('../utils/notify');
const { logActivity } = require('../utils/audit');
const router = express.Router();

router.use(requireAuth);

// POST /api/chat/conversations -- start or get existing conversation
router.post('/conversations', async (req, res) => {
  try {
    const { sellerId, productId, productTitle, productImage } = req.body;
    if (!sellerId) return res.status(400).json({ message: 'sellerId is required' });
    if (req.user.role === 'seller') return res.status(400).json({ message: 'Sellers cannot initiate chats' });

    const customerId = req.user._id.toString();
    if (customerId === sellerId) return res.status(400).json({ message: 'Cannot chat with yourself' });

    // Check if conversation already exists between this buyer and seller (for same product or general)
    const filter = {
      'participants.userId': { $all: [req.user._id, sellerId] },
      status: 'active'
    };
    if (productId) filter.productId = productId;
    else filter.productId = null;

    let conversation = await Conversation.findOne(filter);
    if (conversation) return res.json({ conversation, isNew: false });

    // Get seller name
    const seller = await Seller.findById(sellerId).select('sellerProfile.businessName name').lean();
    const sellerName = seller?.sellerProfile?.businessName || seller?.name || 'Seller';

    conversation = new Conversation({
      participants: [
        { userId: req.user._id, userRole: 'customer', name: req.user.name || req.user.email?.split('@')[0] || 'Customer' },
        { userId: sellerId, userRole: 'seller', name: sellerName }
      ],
      productId: productId || null,
      productTitle: productTitle || '',
      productImage: productImage || '',
      unreadCounts: new Map([[customerId, 0], [sellerId, 0]])
    });
    await conversation.save();

    logActivity({ domain: 'system', action: 'chat_started', actorRole: req.user.role, actorId: req.user._id, actorEmail: req.user.email, targetType: 'Conversation', targetId: conversation._id, message: `Chat started with seller ${sellerName}`, metadata: { sellerId, productId } });

    res.status(201).json({ conversation, isNew: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/chat/conversations -- list user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.userId': req.user._id,
      status: 'active'
    }).sort({ updatedAt: -1 }).lean();

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chat/conversations/:id/messages -- paginated message history
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    // Verify user is a participant
    const isParticipant = conversation.participants.some(p => p.userId.toString() === req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ message: 'Not a participant' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 30);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments({ conversationId: req.params.id })
    ]);

    // Mark unread messages from the other person as read
    const unreadFromOthers = messages.filter(m => m.senderId.toString() !== req.user._id.toString() && !m.readAt);
    if (unreadFromOthers.length) {
      await Message.updateMany(
        { _id: { $in: unreadFromOthers.map(m => m._id) } },
        { readAt: new Date() }
      );
      // Reset unread count for this user
      conversation.unreadCounts.set(req.user._id.toString(), 0);
      await conversation.save();
    }

    res.json({ messages: messages.reverse(), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chat/conversations/:id/messages -- send a message (REST fallback)
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { content, images } = req.body;
    if (!content && (!images || !images.length)) return res.status(400).json({ message: 'Message content required' });

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(p => p.userId.toString() === req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ message: 'Not a participant' });

    // DB-first: save message before emitting
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: req.user.role,
      senderName: req.user.name || req.user.email?.split('@')[0] || 'Customer',
      content: content || '',
      images: images || []
    });

    // Update conversation denormalized fields
    conversation.lastMessage = {
      content: content || '(image)',
      senderId: req.user._id,
      sentAt: message.createdAt
    };

    // Increment unread count for the other participant
    const otherParticipant = conversation.participants.find(p => p.userId.toString() !== req.user._id.toString());
    if (otherParticipant) {
      const otherId = otherParticipant.userId.toString();
      const currentCount = conversation.unreadCounts.get(otherId) || 0;
      conversation.unreadCounts.set(otherId, currentCount + 1);

      // Push message to other user via Socket.io
      emitToUser(otherId, 'newMessage', {
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

      // Create notification for offline delivery
      createNotification({
        userId: otherId,
        userRole: otherParticipant.userRole,
        type: 'new_message',
        title: `New message from ${req.user.name || req.user.email?.split('@')[0] || 'Customer'}`,
        message: (content || '(image)').substring(0, 100),
        link: otherParticipant.userRole === 'seller' ? '/seller/chat' : '/chat',
        metadata: { conversationId: conversation._id.toString() }
      });
    }

    await conversation.save();

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
