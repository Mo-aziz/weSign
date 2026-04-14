const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { userToJson } = require('../views/user.view');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens');

async function register(req, res, next) {
  try {
    const existingByPhone = await User.findByPhoneNumber(
      req.body.phoneNumber,
    );
    if (existingByPhone) {
      return res
        .status(409)
        .json({ message: 'phoneNumber is already registered' });
    }

    const existingByEmail = await User.findByEmail(req.body.email);
    if (existingByEmail) {
      return res
        .status(409)
        .json({ message: 'email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = await User.create({
      ...req.body,
      password: hashedPassword,
    });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.status(201).json({
      user: userToJson(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { phoneNumber, password } = req.body;

    const user = await User.findByPhoneNumber(phoneNumber);
    if (!user) {
      return res
        .status(401)
        .json({ message: 'Invalid phoneNumber or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: 'Invalid phoneNumber or password' });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.json({
      user: userToJson(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.updateById(id, req.body);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userToJson(user));
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await User.deleteById(id);

    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { phoneNumber } = req.body;

    const user = await User.findByPhoneNumber(phoneNumber);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const result = await User.createResetToken(user.id);
    if (!result) {
      return res.status(500).json({ message: 'Could not create reset token' });
    }

    res.json({
      message: 'Reset token created',
      resetToken: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { phoneNumber, resetToken, newPassword } = req.body;

    const user = await User.findByPhoneNumber(phoneNumber);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const ok = await User.resetPassword(
      user.id,
      resetToken,
      hashedPassword,
    );
    if (!ok) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

async function registerDeviceToken(req, res, next) {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({ message: 'deviceToken is required' });
    }
    await User.addDeviceToken(req.user.id, deviceToken.trim());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    // Accept refreshToken from either Authorization header or request body
    let refreshToken = req.body.refreshToken;
    
    // If not in body, check Authorization header: "Bearer <token>"
    if (!refreshToken && req.headers.authorization?.startsWith('Bearer ')) {
      refreshToken = req.headers.authorization.split(' ')[1];
    }
    
    if (!refreshToken) {
      return res
        .status(400)
        .json({ message: 'refreshToken is required' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'Invalid refreshToken' });
    }

    const accessToken = createAccessToken(user);

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function loginUsername(req, res, next) {
  try {
    const { username, password, isDeaf } = req.body;

    // Validate required fields
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({
        message: 'username must be at least 3 characters long',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        message: 'password must be at least 6 characters long',
      });
    }

    const trimmedUsername = username.trim();
    console.log(`🔐 Login attempt: username="${trimmedUsername}"`);
    
    // Check if user exists
    let user = await User.findByUsername(trimmedUsername);

    if (user) {
      console.log(`✓ User found: ${trimmedUsername}`);
      // User exists - validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`✗ Invalid password for user: ${trimmedUsername}`);
        return res.status(401).json({
          message: 'Invalid username or password',
        });
      }
      
      console.log(`✓ Login successful for: ${trimmedUsername}`);
      // Login successful
      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user);

      return res.json({
        user: userToJson(user),
        accessToken,
        refreshToken,
      });
    }

    console.log(`⚠️  User not found: ${trimmedUsername} - Auto-signup`);
    // User doesn't exist - create new account (sign up)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate default values for required fields
    const newUser = await User.create({
      username: trimmedUsername,
      firstName: trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1),
      lastName: 'User',
      phoneNumber: `${Date.now()}`, // Temporary unique phone number
      email: `${trimmedUsername}-${Date.now()}@wesign.local`, // Temporary email
      dob: new Date('2000-01-01'), // Default date of birth
      password: hashedPassword,
      isDeafMute: isDeaf ?? true, // Default to deaf if not specified
    });

    if (!newUser) {
      return res.status(500).json({ message: 'Failed to create user' });
    }

    console.log(`✓ New user created: ${trimmedUsername}`);
    const accessToken = createAccessToken(newUser);
    const refreshToken = createRefreshToken(newUser);

    res.status(201).json({
      user: userToJson(newUser),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(`❌ Login error for user:`, err);
    if (err.code === 11000) {
      // Duplicate key error
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        message: `This ${field} is already registered`,
      });
    }
    next(err);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userToJson(user));
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userToJson(user));
  } catch (err) {
    next(err);
  }
}

async function getUserByUsername(req, res, next) {
  try {
    const { username } = req.params;
    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userToJson(user));
  } catch (err) {
    next(err);
  }
}

async function checkUsernameExists(req, res, next) {
  try {
    const { username } = req.params;
    const user = await User.findByUsername(username);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ exists: true, user: userToJson(user) });
  } catch (err) {
    next(err);
  }
}

async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Search by username with case-insensitive regex
    const query = q.trim();
    const users = await User.findByUsernamePattern(query);

    res.json(users.map(user => userToJson(user)));
  } catch (err) {
    next(err);
  }
}

async function getUserStatus(req, res, next) {
  try {
    const { userId } = req.params;
    
    // For now, return offline as default (can be enhanced with Socket.io later)
    // You can track user status using Socket.io connected users
    res.json({ status: 'offline' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  loginUsername,
  updateUser,
  deleteUser,
  forgotPassword,
  resetPassword,
  refresh,
  registerDeviceToken,
  getCurrentUser,
  getUserById,
  getUserByUsername,
  checkUsernameExists,
  searchUsers,
  getUserStatus,
};

