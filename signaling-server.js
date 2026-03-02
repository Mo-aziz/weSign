// Simple WebSocket Signaling Server for Sign Language Communicator
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 3001;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Signaling server running', port: PORT }));
});

const wss = new WebSocketServer({ server });

// Store connected clients: userId -> WebSocket
const clients = new Map();

wss.on('connection', (ws, req) => {
  let userId = null;
  let username = null;

  console.log('New WebSocket connection from:', req.socket.remoteAddress);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          // Client registering with their user ID
          userId = data.userId;
          username = data.username;
          clients.set(userId, ws);
          console.log(`User registered: ${username} (${userId})`);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'registered',
            success: true,
            userId: userId
          }));
          break;

        case 'call-invite':
        case 'call-accept':
        case 'call-reject':
        case 'call-end':
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Forward signaling messages to target user
          const targetWs = clients.get(data.to);
          if (targetWs && targetWs.readyState === 1) {
            targetWs.send(JSON.stringify(data));
            console.log(`Forwarded ${data.type} from ${data.from} to ${data.to}`);
          } else {
            console.log(`Target user ${data.to} not connected`);
            // Notify sender that target is offline
            ws.send(JSON.stringify({
              type: 'error',
              message: `User ${data.to} is offline`
            }));
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`User disconnected: ${username} (${userId})`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
