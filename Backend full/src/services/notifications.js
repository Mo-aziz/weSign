const User = require('../models/user.model');

/**
 * Stub: notify a user of an incoming call.
 * Replace with FCM/APNs when push is configured.
 */
async function notifyIncomingCall(deafUserId, callId, callerInfo = {}) {
  const tokens = await User.getDeviceTokens(deafUserId);
  if (tokens.length === 0) {
    console.log('[notifications] No device tokens for user', deafUserId, '- skipping push');
    return;
  }
  // TODO: integrate FCM/APNs - send to tokens with payload { type: 'incoming_call', callId, callerInfo }
  console.log('[notifications] Incoming call', callId, 'to user', deafUserId, 'tokens:', tokens.length);
}

module.exports = {
  notifyIncomingCall,
};
