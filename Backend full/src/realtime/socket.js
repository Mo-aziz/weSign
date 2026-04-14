function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);

    socket.on('joinCall', ({ callId }) => {
      if (!callId) return;
      socket.join(`call:${callId}`);
    });

    socket.on('joinConversation', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
    });

    // Streaming recognized text for calls
    socket.on('call:transcript', (payload) => {
      const { callId } = payload || {};
      if (!callId) return;
      io.to(`call:${callId}`).emit('call:transcript', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    // Streaming messages for live conversations
    socket.on('conversation:message', (payload) => {
      const { conversationId } = payload || {};
      if (!conversationId) return;
      io.to(`conversation:${conversationId}`).emit('conversation:message', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    // WebRTC signaling (offer/answer/ICE) per call room
    socket.on('webrtc:offer', (payload) => {
      const { callId } = payload || {};
      if (!callId) return;
      socket.to(`call:${callId}`).emit('webrtc:offer', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc:answer', (payload) => {
      const { callId } = payload || {};
      if (!callId) return;
      socket.to(`call:${callId}`).emit('webrtc:answer', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc:iceCandidate', (payload) => {
      const { callId } = payload || {};
      if (!callId) return;
      socket.to(`call:${callId}`).emit('webrtc:iceCandidate', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected', socket.id);
    });
  });
}

module.exports = {
  setupSocket,
};

