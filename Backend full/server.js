require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { setupSocket } = require('./src/realtime/socket');
const { validateEnv } = require('./src/config/env');
const { getSocketCorsOptions } = require('./src/config/cors');

validateEnv();

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: getSocketCorsOptions(),
});

setupSocket(io);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});

