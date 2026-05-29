const isProduction = process.env.NODE_ENV === 'production';

const REQUIRED_IN_PRODUCTION = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

function validateEnv() {
  if (!isProduction) {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables for production: ${missing.join(', ')}`,
    );
    process.exit(1);
  }
}

function getJwtAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (isProduction && !secret) {
    throw new Error('JWT_ACCESS_SECRET is required in production');
  }
  return secret || 'dev-only-access-secret';
}

function getJwtRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (isProduction && !secret) {
    throw new Error('JWT_REFRESH_SECRET is required in production');
  }
  return secret || 'dev-only-refresh-secret';
}

module.exports = {
  isProduction,
  validateEnv,
  getJwtAccessSecret,
  getJwtRefreshSecret,
};
