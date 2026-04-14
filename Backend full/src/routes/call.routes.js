const express = require('express');
const CallController = require('../controllers/call.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, CallController.createCall);
router.post('/:id/accept', authenticate, CallController.acceptCall);
router.post('/:id/end', authenticate, CallController.endCall);
router.post('/:id/transcript', authenticate, CallController.addTranscript);
router.get('/:id', authenticate, CallController.getCall);

module.exports = router;

