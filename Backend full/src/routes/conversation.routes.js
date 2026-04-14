const express = require('express');
const ConversationController = require('../controllers/conversation.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, ConversationController.createConversation);
router.post('/:id/messages', authenticate, ConversationController.addMessage);
router.get('/:id', authenticate, ConversationController.getConversation);

module.exports = router;

