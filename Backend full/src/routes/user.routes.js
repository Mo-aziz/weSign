const express = require('express');
const UserController = require('../controllers/user.controller');
const {
  validateRegistration,
  validateLogin,
  validateUpdate,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/authValidation');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Registration endpoint with auth-related middleware
router.post('/register', validateRegistration, UserController.register);

// Login with phoneNumber and password
router.post('/login', validateLogin, UserController.login);

// Login with username and password (auto-signup if not exists)
router.post('/login-username', UserController.loginUsername);

// Refresh access token
router.post('/refresh', UserController.refresh);

// Register device token for push (FCM/APNs)
router.post('/me/device-token', authenticate, UserController.registerDeviceToken);

// Get current authenticated user
router.get('/me', authenticate, UserController.getCurrentUser);

// Search users by username
router.get('/search', UserController.searchUsers);

// Check if username exists
router.get('/check/username/:username', UserController.checkUsernameExists);

// Get user by username
router.get('/username/:username', UserController.getUserByUsername);

// Get user status (must be before /:id to avoid wildcard match)
router.get('/:userId/status', UserController.getUserStatus);

// Get user by ID
router.get('/:id', UserController.getUserById);

// Update user by id
router.put('/:id', authenticate, validateUpdate, UserController.updateUser);

// Delete user by id
router.delete('/:id', authenticate, UserController.deleteUser);

// Forgot / reset password
router.post(
  '/forgot-password',
  validateForgotPassword,
  UserController.forgotPassword,
);
router.post(
  '/reset-password',
  validateResetPassword,
  UserController.resetPassword,
);

module.exports = router;

