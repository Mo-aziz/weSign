// Simple WebSocket Signaling Server for Sign Language Communicator (WSS - Secure)
import { WebSocketServer } from 'ws';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Certificate paths
const keyFile = path.join(__dirname, 'certs', 'key.pem');
const certFile = path.join(__dirname, 'certs', 'cert.pem');

// Check if certificates exist
if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  console.error('\n❌ HTTPS certificates not found!');
  console.error(`Expected: ${keyFile}`);
  console.error(`Expected: ${certFile}\n`);
  console.error('Generate certificates by running:');
  console.error('  node scripts/generate-certs.js\n');
  process.exit(1);
}

// Create HTTPS server with WebSocket
const server = https.createServer(
  {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile),
  },
  (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Signaling server running on WSS', port: PORT }));
  }
);

const wss = new WebSocketServer({ server });

// Store connected clients: userId -> { ws: WebSocket, username: string, isDeaf: boolean }
const clients = new Map();

wss.on('connection', (ws, req) => {
  let userId = null;
  let username = null;
  let isDeaf = null;

  console.log('✓ New WebSocket connection from:', req.socket.remoteAddress);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          userId = data.userId;
          username = data.username;
          isDeaf = data.isDeaf;
          clients.set(userId, { ws, username, isDeaf });
          console.log(`✓ User registered: ${username} (${userId}) - ${isDeaf ? 'Deaf' : 'Hearing'}`);
          ws.send(JSON.stringify({
            type: 'registered',
            success: true,
            userId: userId
          }));
          break;

        case 'user-update':
          // Update user's type when they toggle in Settings
          if (userId && clients.has(userId)) {
            const oldIsDeaf = clients.get(userId).isDeaf;
            const newIsDeaf = data.isDeaf;
            
            // Update in-memory record
            clients.get(userId).isDeaf = newIsDeaf;
            
            console.log(`✓ Updated user type for ${username} (${userId}): ${oldIsDeaf ? 'Deaf' : 'Hearing'} → ${newIsDeaf ? 'Deaf' : 'Hearing'}`);
            
            // Confirm update was received
            ws.send(JSON.stringify({
              type: 'user-update-confirmed',
              success: true,
              userId: userId,
              newIsDeaf: newIsDeaf
            }));
          }
          break;

        case 'query-user':
          // Query for a user's status
          const targetUser = clients.get(data.userId);
          if (targetUser) {
            ws.send(JSON.stringify({
              type: 'user-status',
              userId: data.userId,
              username: targetUser.username,
              isDeaf: targetUser.isDeaf,
              isOnline: true
            }));
            console.log(`✓ Sent status for ${targetUser.username} (isDeaf: ${targetUser.isDeaf}) to ${username}`);
          } else {
            // User offline - respond with default (deaf=true to be safe, so hearing can't call deaf who's offline)
            ws.send(JSON.stringify({
              type: 'user-status',
              userId: data.userId,
              isDeaf: true,
              isOnline: false
            }));
            console.log(`⚠ User ${data.userId} not found/offline, reporting as deaf and offline`);
          }
          break;

        case 'call-invite':
        case 'call-accept':
        case 'call-reject':
        case 'call-end':
        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'sign-translation':
        case 'speech-transcript':
          const targetWs = clients.get(data.to);
          if (targetWs && targetWs.ws.readyState === 1) {
            targetWs.ws.send(JSON.stringify(data));
            console.log(`✓ Forwarded ${data.type} from ${data.from} to ${data.to}`);
          } else {
            console.log(`⚠ Target user ${data.to} not connected for ${data.type}`);
            ws.send(JSON.stringify({
              type: 'error',
              message: `User ${data.to} is offline`
            }));
          }
          break;

        default:
          console.log('⚠ Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`✓ User disconnected: ${username} (${userId})`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ Signaling server running on WSS port ${PORT}`);
  console.log(`✓ Both HTTP and WSS available (WSS for remote clients)`);
  console.log(`✓ Access via: wss://192.168.X.X:${PORT}/\n`);
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
