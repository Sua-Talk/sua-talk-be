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
  validateChangePassword,
  validateOAuthQuery,
  validateEmailCheck,
  validateOTPAndRegistration
} = require('../middleware/validation');

// Import error handling middleware
const { databaseErrorMiddleware } = require('../utils/dbErrorHandler');
const { handleValidationErrors } = require('../middleware/errorHandler');

// Import rate limiting middleware
const {
  loginRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  oauthRateLimit
} = require('../middleware/rateLimiting');

/**
 * RECOMMENDED REGISTRATION FLOW (2-Step Process)
 */

/**
 * @route   POST /api/auth/check-email
 * @desc    Step 1: Check email and send OTP for verification
 * @access  Public
 * @body    { email }
 */
router.post('/check-email', registrationRateLimit, validateEmailCheck, authController.checkEmailAndSendOTP);

/**
 * @route   POST /api/auth/confirm-email
 * @desc    Step 2: Confirm OTP to verify email address
 * @access  Public
 * @body    { email, code }
 */
router.post('/confirm-email', emailVerificationRateLimit, validateEmailVerification, authController.confirmEmail);

/**
 * @route   POST /api/auth/complete-registration
 * @desc    Step 2: Verify OTP and complete user registration
 * @access  Public
 * @body    { email, code, password, firstName, lastName }
 */
router.post('/complete-registration', registrationRateLimit, validateOTPAndRegistration, authController.verifyOTPAndRegister);

/**
 * LEGACY REGISTRATION FLOW (For backward compatibility)
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (legacy flow)
 * @access  Public
 * @body    { email, password, firstName, lastName }
 * @deprecated Use /check-email and /complete-registration instead
 */
router.post('/register', registrationRateLimit, validateRegistration, authController.register);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with OTP (legacy flow)
 * @access  Public
 * @body    { email, code }
 * @deprecated Use /complete-registration instead
 */
router.post('/verify-email', emailVerificationRateLimit, validateEmailVerification, authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification OTP
 * @access  Public
 * @body    { email }
 */
router.post('/resend-verification', emailVerificationRateLimit, validateResendVerification, authController.resendVerificationEmail);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT tokens
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', loginRateLimit, validateLogin, authController.login);

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
router.post('/forgot-password', passwordResetRateLimit, validateForgotPassword, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    { token, newPassword }
 */
router.post('/reset-password', passwordResetRateLimit, validateResetPassword, authController.resetPassword);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.post('/change-password', authenticate, validateChangePassword, authController.changePassword);

// Google OAuth Routes
/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth authentication
 * @access  Public
 * @query   { redirect? }
 */
router.get('/google', oauthRateLimit, validateOAuthQuery, handleValidationErrors, authController.googleAuth);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', oauthRateLimit, authController.googleCallback);

/**
 * @route   GET /api/auth/oauth-success
 * @desc    OAuth success page for token handling
 * @access  Public
 */
router.get('/oauth-success', authController.oauthSuccess);

// Apply database error handling middleware
router.use(databaseErrorMiddleware);

module.exports = router; 