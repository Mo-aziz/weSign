const { isProduction } = require('./env');

const DEV_ORIGINS = [
  'http://localhost:1420',
  'http://localhost:5173',
  'http://127.0.0.1:1420',
  'http://127.0.0.1:5173',
  'https://localhost:1420',
  'https://localhost:5173',
  'https://127.0.0.1:1420',
  'https://127.0.0.1:5173',
  'tauri://localhost',
];

function parseClientOrigins() {
  const raw = process.env.CLIENT_ORIGIN;
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const clientOrigins = parseClientOrigins();

  if (isProduction) {
    return clientOrigins;
  }

  const origins = new Set([...DEV_ORIGINS, ...clientOrigins]);
  return Array.from(origins);
}

function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      // Native/mobile clients and server-to-server calls often omit Origin.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0) {
        return callback(
          new Error(
            'CLIENT_ORIGIN is not configured. Set comma-separated HTTPS origins.',
          ),
        );
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  };
}

function getSocketCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  if (!isProduction) {
    return {
      origin: allowedOrigins.length > 0 ? allowedOrigins : DEV_ORIGINS,
      methods: ['GET', 'POST'],
    };
  }

  if (allowedOrigins.length === 0) {
    return {
      origin: false,
      methods: ['GET', 'POST'],
    };
  }

  return {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  };
}

module.exports = {
  DEV_ORIGINS,
  getAllowedOrigins,
  createCorsOptions,
  getSocketCorsOptions,
};
