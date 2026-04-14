const Conversation = require('../models/conversation.model');

async function createConversation(req, res, next) {
  try {
    const { locationType } = req.body;

    const conversation = await Conversation.create({
      userId: req.user.id,
      locationType,
      status: 'active',
      startedAt: new Date(),
    });

    res.status(201).json({
      id: conversation._id.toString(),
      userId: conversation.userId.toString(),
      locationType: conversation.locationType,
      status: conversation.status,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages,
    });
  } catch (err) {
    next(err);
  }
}

async function addMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { text, from = 'user', language } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'text is required' });
    }

    const existing = await Conversation.findById(id).lean().exec();
    if (!existing) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (String(existing.userId) !== req.user.id) {
      return res.status(403).json({ message: 'Not the owner of this conversation' });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      id,
      {
        $push: {
          messages: {
            from,
            text,
            language,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    res.json({
      id: conversation._id.toString(),
      userId: conversation.userId.toString(),
      locationType: conversation.locationType,
      status: conversation.status,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages,
    });
  } catch (err) {
    next(err);
  }
}

async function getConversation(req, res, next) {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id).lean().exec();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (String(conversation.userId) !== req.user.id) {
      return res.status(403).json({ message: 'Not the owner of this conversation' });
    }

    res.json({
      id: conversation._id.toString(),
      userId: conversation.userId.toString(),
      locationType: conversation.locationType,
      status: conversation.status,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createConversation,
  addMessage,
  getConversation,
};

