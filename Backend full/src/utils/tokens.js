const jwt = require('jsonwebtoken');
const { getJwtAccessSecret, getJwtRefreshSecret } = require('../config/env');

function createAccessToken(user) {
  const payload = {
    sub: user.id,
    phoneNumber: user.phoneNumber,
    isDeafMute: user.isDeafMute,
  };

  const expiresIn =
    process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';

  return jwt.sign(payload, getJwtAccessSecret(), { expiresIn });
}

function createRefreshToken(user) {
  const payload = {
    sub: user.id,
  };

  const expiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getJwtRefreshSecret());
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
};

