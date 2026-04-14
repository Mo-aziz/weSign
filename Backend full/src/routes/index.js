const express = require('express');
const userRoutes = require('./user.routes');
const callRoutes = require('./call.routes');
const conversationRoutes = require('./conversation.routes');

const router = express.Router();

router.use('/users', userRoutes);
router.use('/calls', callRoutes);
router.use('/conversations', conversationRoutes);

module.exports = router;

