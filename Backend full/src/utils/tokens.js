const jwt = require('jsonwebtoken');

function createAccessToken(user) {
  const payload = {
    sub: user.id,
    phoneNumber: user.phoneNumber,
    isDeafMute: user.isDeafMute,
  };

  const expiresIn =
    process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';

  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    { expiresIn },
  );
}

function createRefreshToken(user) {
  const payload = {
    sub: user.id,
  };

  const expiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn },
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  );
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
};

