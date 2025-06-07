const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const Token = require('../models/Token');
const { withErrorHandling } = require('../utils/dbErrorHandler');
const emailService = require('../services/emailService');
const jwtService = require('../services/jwtService');

// User Registration
const register = withErrorHandling(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: true,
      message: 'User with this email already exists'
    });
  }

  // Create new user
  const user = new User({
    email,
    password, // Will be hashed by pre-save hook
    firstName,
    lastName,
    phone,
    isEmailVerified: false
  });

  await user.save();

  // Generate OTP for email verification
  const otp = await OTP.createOTP(email, 'email_verification', {
    expirationMinutes: 10,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(email, firstName, otp.code);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    // Don't fail registration if email fails, user can request resend
  }

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please check your email for verification code.',
    data: {
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified
    }
  });
});

// Email Verification
const verifyEmail = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, code } = req.body;

  // Verify OTP
  const otpResult = await OTP.verifyOTP(email, code, 'email_verification');
  
  if (!otpResult.success) {
    return res.status(400).json({
      error: true,
      message: otpResult.error,
      attemptsRemaining: otpResult.attemptsRemaining
    });
  }

  // Find and update user
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({
      error: true,
      message: 'User not found'
    });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({
      error: true,
      message: 'Email is already verified'
    });
  }

  // Mark email as verified
  user.isEmailVerified = true;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: {
      userId: user._id,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    }
  });
});

// Resend Verification Email
const resendVerificationEmail = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  // Check if user exists
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({
      error: true,
      message: 'User not found'
    });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({
      error: true,
      message: 'Email is already verified'
    });
  }

  // Check rate limiting
  const rateLimit = await OTP.checkRateLimit(email, 'email_verification');
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: true,
      message: 'Too many verification requests. Please try again later.',
      resetAt: rateLimit.resetAt
    });
  }

  // Generate new OTP
  const otp = await OTP.createOTP(email, 'email_verification', {
    expirationMinutes: 10,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(email, user.firstName, otp.code);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    res.status(500).json({
      error: true,
      message: 'Failed to send verification email. Please try again later.'
    });
  }
});

// User Login
const login = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user by email
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({
      error: true,
      message: 'Invalid email or password'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(401).json({
      error: true,
      message: 'Account has been deactivated. Please contact support.'
    });
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    return res.status(401).json({
      error: true,
      message: 'Please verify your email address before logging in',
      requiresEmailVerification: true
    });
  }

  // Verify password
  try {
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    return res.status(401).json({
      error: true,
      message: 'Invalid email or password'
    });
  }

  // Generate JWT tokens
  const tokens = jwtService.generateTokenPair(user);

  // Create refresh token in database
  await Token.createRefreshToken(user._id, {
    expirationDays: 30,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Update last login
  await user.updateLastLogin();

  // Send response
  const response = jwtService.createTokenResponse(tokens, user);
  res.json(response);
});

// Refresh Token
const refreshToken = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { refreshToken: tokenValue } = req.body;

  // Verify JWT refresh token
  const jwtResult = jwtService.verifyRefreshToken(tokenValue);
  if (!jwtResult.success) {
    return res.status(401).json({
      error: true,
      message: 'Invalid or expired refresh token'
    });
  }

  // Find user
  const user = await User.findById(jwtResult.decoded.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({
      error: true,
      message: 'User not found or account deactivated'
    });
  }

  // Generate new tokens
  const newTokens = jwtService.generateTokenPair(user);

  // Create new refresh token in database
  await Token.createRefreshToken(user._id, {
    expirationDays: 30,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send response
  const response = jwtService.createTokenResponse(newTokens, user);
  res.json(response);
});

// Logout
const logout = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { refreshToken: tokenValue } = req.body;

  // Verify and invalidate refresh token
  const jwtResult = jwtService.verifyRefreshToken(tokenValue);
  if (jwtResult.success) {
    // Invalidate all refresh tokens for this user
    await Token.updateMany(
      { 
        userId: jwtResult.decoded.userId, 
        type: 'refresh', 
        isUsed: false 
      },
      { 
        isUsed: true,
        usedAt: new Date()
      }
    );
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Forgot Password
const forgotPassword = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  // Find user by email
  const user = await User.findByEmail(email);
  if (!user) {
    // Don't reveal if email exists or not for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }

  // Check rate limiting for password reset requests
  const rateLimit = await OTP.checkRateLimit(email, 'password_reset');
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: true,
      message: 'Too many password reset requests. Please try again later.',
      resetAt: rateLimit.resetAt
    });
  }

  // Generate password reset token
  const resetToken = await Token.createResetToken(user._id, {
    expirationHours: 1, // 1 hour expiry
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(email, user.firstName, resetToken.token);
    
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    res.status(500).json({
      error: true,
      message: 'Failed to send password reset email. Please try again later.'
    });
  }
});

// Reset Password
const resetPassword = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { token, newPassword } = req.body;

  // Find and validate reset token
  const resetToken = await Token.findOne({
    token,
    type: 'reset',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  }).populate('userId');

  if (!resetToken) {
    return res.status(400).json({
      error: true,
      message: 'Invalid or expired reset token'
    });
  }

  const user = resetToken.userId;
  if (!user || !user.isActive) {
    return res.status(400).json({
      error: true,
      message: 'Invalid or expired reset token'
    });
  }

  // Update user password
  user.password = newPassword; // Will be hashed by pre-save hook
  await user.save();

  // Mark reset token as used
  resetToken.isUsed = true;
  resetToken.usedAt = new Date();
  await resetToken.save();

  // Invalidate all existing refresh tokens for security
  await Token.updateMany(
    { 
      userId: user._id, 
      type: 'refresh', 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedAt: new Date()
    }
  );

  res.json({
    success: true,
    message: 'Password has been reset successfully. Please log in with your new password.'
  });
});

// Change Password
const changePassword = withErrorHandling(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id; // Authentication middleware sets req.user

  // Find user
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return res.status(401).json({
      error: true,
      message: 'User not found or account deactivated'
    });
  }

  // Verify current password
  try {
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: true,
        message: 'Current password is incorrect'
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: true,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword; // Will be hashed by pre-save hook
  await user.save();

  // Invalidate all existing refresh tokens for security
  await Token.updateMany(
    { 
      userId: user._id, 
      type: 'refresh', 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedAt: new Date()
    }
  );

  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again with your new password.'
  });
});

module.exports = {
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword
}; 