const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validateUpdateProfile, validateDeleteAccount } = require('../middleware/validation');
const { uploadAvatar, handleUploadError } = require('../middleware/upload');
const { 
  profileRateLimit, 
  avatarUploadRateLimit, 
  accountDeletionRateLimit, 
  profileUpdateRateLimit 
} = require('../middleware/rateLimiting');
const { 
  sanitizeInput, 
  securityLogger, 
  validateFileUpload 
} = require('../middleware/security');

/**
 * @route GET /api/users/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', profileRateLimit, authenticate, securityLogger, userController.getProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', profileUpdateRateLimit, authenticate, sanitizeInput, securityLogger, validateUpdateProfile, userController.updateProfile);

/**
 * @route POST /api/users/upload-avatar
 * @desc Upload user avatar
 * @access Private
 */
router.post('/upload-avatar', avatarUploadRateLimit, authenticate, uploadAvatar, handleUploadError, validateFileUpload, securityLogger, userController.uploadUserAvatar);

/**
 * @route DELETE /api/users/account
 * @desc Delete user account
 * @access Private
 */
router.delete('/account', accountDeletionRateLimit, authenticate, sanitizeInput, securityLogger, validateDeleteAccount, userController.deleteAccount);

module.exports = router; 