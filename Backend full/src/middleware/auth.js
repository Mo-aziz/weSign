const jwt = require('jsonwebtoken');
const { getJwtAccessSecret } = require('../config/env');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, getJwtAccessSecret());
    req.user = {
      id: payload.sub,
      phoneNumber: payload.phoneNumber,
      isDeafMute: payload.isDeafMute,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = {
  authenticate,
};

