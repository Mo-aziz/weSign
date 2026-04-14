function validateRegistration(req, res, next) {
  const {
    firstName,
    lastName,
    phoneNumber,
    email,
    dob,
    password,
    isDeafMute,
  } = req.body || {};

  const missingFields = [];

  if (!firstName) missingFields.push('firstName');
  if (!lastName) missingFields.push('lastName');
  if (!phoneNumber) missingFields.push('phoneNumber');
  if (!email) missingFields.push('email');
  if (!dob) missingFields.push('dob');
  if (!password) missingFields.push('password');

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: 'Missing required fields',
      fields: missingFields,
    });
  }

  if (typeof firstName !== 'string' || firstName.trim().length < 3) {
    return res.status(400).json({
      message: 'firstName must be at least 3 characters long',
    });
  }

  if (typeof lastName !== 'string' || lastName.trim().length < 3) {
    return res.status(400).json({
      message: 'lastName must be at least 3 characters long',
    });
  }

  const phoneRegex = /^\d{11}$/;
  if (
    typeof phoneNumber !== 'string' ||
    !phoneRegex.test(phoneNumber)
  ) {
    return res.status(400).json({
      message: 'phoneNumber must be exactly 11 digits',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      message: 'password must be at least 8 characters long',
    });
  }

  if (typeof isDeafMute !== 'boolean') {
    return res.status(400).json({
      message: 'Invalid or missing isDeafMute flag',
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { phoneNumber, password } = req.body || {};

  if (!phoneNumber || !password) {
    return res.status(400).json({
      message: 'phoneNumber and password are required',
    });
  }

  const phoneRegex = /^\d{11}$/;
  if (
    typeof phoneNumber !== 'string' ||
    !phoneRegex.test(phoneNumber)
  ) {
    return res.status(400).json({
      message: 'phoneNumber must be exactly 11 digits',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      message: 'password must be at least 8 characters long',
    });
  }

  next();
}

function validateUpdate(req, res, next) {
  const {
    firstName,
    lastName,
    phoneNumber,
    email,
    dob,
    password,
    isDeafMute,
  } = req.body || {};

  if (
    firstName !== undefined &&
    (typeof firstName !== 'string' || firstName.trim().length < 3)
  ) {
    return res.status(400).json({
      message: 'firstName must be at least 3 characters long',
    });
  }

  if (
    lastName !== undefined &&
    (typeof lastName !== 'string' || lastName.trim().length < 3)
  ) {
    return res.status(400).json({
      message: 'lastName must be at least 3 characters long',
    });
  }

  const phoneRegex = /^\d{11}$/;
  if (
    phoneNumber !== undefined &&
    (typeof phoneNumber !== 'string' || !phoneRegex.test(phoneNumber))
  ) {
    return res.status(400).json({
      message: 'phoneNumber must be exactly 11 digits',
    });
  }

  if (
    password !== undefined &&
    (typeof password !== 'string' || password.length < 8)
  ) {
    return res.status(400).json({
      message: 'password must be at least 8 characters long',
    });
  }

  if (
    isDeafMute !== undefined &&
    typeof isDeafMute !== 'boolean'
  ) {
    return res.status(400).json({
      message: 'Invalid isDeafMute flag',
    });
  }

  next();
}

function validateForgotPassword(req, res, next) {
  const { phoneNumber } = req.body || {};

  if (!phoneNumber) {
    return res.status(400).json({
      message: 'phoneNumber is required',
    });
  }

  const phoneRegex = /^\d{11}$/;
  if (
    typeof phoneNumber !== 'string' ||
    !phoneRegex.test(phoneNumber)
  ) {
    return res.status(400).json({
      message: 'phoneNumber must be exactly 11 digits',
    });
  }

  next();
}

function validateResetPassword(req, res, next) {
  const { phoneNumber, resetToken, newPassword } = req.body || {};

  if (!phoneNumber || !resetToken || !newPassword) {
    return res.status(400).json({
      message: 'phoneNumber, resetToken and newPassword are required',
    });
  }

  const phoneRegex = /^\d{11}$/;
  if (
    typeof phoneNumber !== 'string' ||
    !phoneRegex.test(phoneNumber)
  ) {
    return res.status(400).json({
      message: 'phoneNumber must be exactly 11 digits',
    });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      message: 'newPassword must be at least 8 characters long',
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateUpdate,
  validateForgotPassword,
  validateResetPassword,
};

