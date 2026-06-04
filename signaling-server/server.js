/**
 * WeSign WebSocket signaling server (WebRTC call relay).
 *
 * Local dev: uses HTTPS + certs in ./certs when present (WSS).
 * Railway/production: uses HTTP; Railway edge provides WSS to clients.
 */
import { WebSocketServer } from 'ws';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT !== undefined;

function healthHandler(req, res) {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'wesign-signaling',
        connectedClients: clients.size,
        transport: serverUsesTls ? 'wss' : 'ws',
      }),
    );
    return;
  }
  res.writeHead(404).end();
}

/** @type {Map<string, { ws: import('ws').WebSocket, username: string, isDeaf: boolean }>} */
const clients = new Map();

let serverUsesTls = false;

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    let userId = null;
    let username = null;

    console.log('New WebSocket connection from:', req.socket.remoteAddress);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'register':
            userId = data.userId;
            username = data.username;
            clients.set(userId, { ws, username, isDeaf: data.isDeaf });
            console.log(
              `User registered: ${username} (${userId}) - ${data.isDeaf ? 'Deaf' : 'Hearing'}`,
            );
            ws.send(
              JSON.stringify({
                type: 'registered',
                success: true,
                userId,
              }),
            );
            break;

          case 'user-update':
            if (userId && clients.has(userId)) {
              const record = clients.get(userId);
              record.isDeaf = data.isDeaf;
              ws.send(
                JSON.stringify({
                  type: 'user-update-confirmed',
                  success: true,
                  userId,
                  newIsDeaf: data.isDeaf,
                }),
              );
            }
            break;

          case 'query-user': {
            const targetUser = clients.get(data.userId);
            if (targetUser) {
              ws.send(
                JSON.stringify({
                  type: 'user-status',
                  userId: data.userId,
                  username: targetUser.username,
                  isDeaf: targetUser.isDeaf,
                  isOnline: true,
                }),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: 'user-status',
                  userId: data.userId,
                  isDeaf: true,
                  isOnline: false,
                }),
              );
            }
            break;
          }

          case 'call-invite':
          case 'call-accept':
          case 'call-reject':
          case 'call-end':
          case 'offer':
          case 'answer':
          case 'ice-candidate':
          case 'sign-translation':
          case 'speech-transcript': {
            const targetWs = clients.get(data.to);
            if (targetWs && targetWs.ws.readyState === 1) {
              targetWs.ws.send(JSON.stringify(data));
              console.log(`Forwarded ${data.type} from ${data.from} to ${data.to}`);
            } else {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: `User ${data.to} is offline`,
                }),
              );
            }
            break;
          }

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

  return wss;
}

function createHttpServer() {
  return http.createServer(healthHandler);
}

function createHttpsServer() {
  const keyFile = path.join(__dirname, 'certs', 'key.pem');
  const certFile = path.join(__dirname, 'certs', 'cert.pem');

  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    return null;
  }

  serverUsesTls = true;
  return https.createServer(
    {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    },
    healthHandler,
  );
}

function resolveServer() {
  const forceHttp = process.env.SIGNALING_USE_HTTP === 'true';

  if (isProduction || forceHttp) {
    console.log('Using HTTP (Railway/public edge terminates TLS → clients use wss://)');
    return createHttpServer();
  }

  const httpsServer = createHttpsServer();
  if (httpsServer) {
    console.log('Using local HTTPS certificates (WSS)');
    return httpsServer;
  }

  console.warn('No certs found — falling back to HTTP. Run: node scripts/generate-certs.js');
  return createHttpServer();
}

const server = resolveServer();
const wss = attachWebSocket(server);

server.listen(PORT, HOST, () => {
  const scheme = serverUsesTls ? 'wss' : 'ws';
  console.log(`Signaling server listening on ${HOST}:${PORT}`);
  console.log(`Health: http${serverUsesTls ? 's' : ''}://localhost:${PORT}/health`);
  console.log(`WebSocket URL (local): ${scheme}://localhost:${PORT}`);
  if (isProduction) {
    console.log('Production: connect clients to wss://<your-railway-domain>');
  }
});

function shutdown() {
  wss.close(() => {
    server.close(() => process.exit(0));
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
