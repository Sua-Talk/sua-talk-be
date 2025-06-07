const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');

// Import authentication middleware
const { authenticate } = require('../middleware/auth');

// Import validation middleware
const {
  validateRegistration,
  validateEmailVerification,
  validateResendVerification,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword
} = require('../middleware/validation');

// Import error handling middleware
const { databaseErrorMiddleware } = require('../utils/dbErrorHandler');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, firstName, lastName, phone? }
 */
router.post('/register', validateRegistration, authController.register);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with OTP
 * @access  Public
 * @body    { email, code }
 */
router.post('/verify-email', validateEmailVerification, authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification OTP
 * @access  Public
 * @body    { email }
 */
router.post('/resend-verification', validateResendVerification, authController.resendVerificationEmail);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT tokens
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 * @body    { refreshToken }
 */
router.post('/logout', validateRefreshToken, authController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @body    { email }
 */
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    { token, newPassword }
 */
router.post('/reset-password', validateResetPassword, authController.resetPassword);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.post('/change-password', authenticate, validateChangePassword, authController.changePassword);

// Apply database error handling middleware
router.use(databaseErrorMiddleware);

module.exports = router; 