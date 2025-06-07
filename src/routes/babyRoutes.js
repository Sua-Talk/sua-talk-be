const express = require('express');
const router = express.Router();
const babyController = require('../controllers/babyController');
const { authenticate, requireBabyOwnership } = require('../middleware/auth');
const { validateCreateBaby, validateUpdateBaby } = require('../middleware/validation');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { 
  profileRateLimit, 
  profileUpdateRateLimit 
} = require('../middleware/rateLimiting');
const { 
  sanitizeInput, 
  securityLogger 
} = require('../middleware/security');
const { 
  uploadBabyPhoto, 
  handleUploadError 
} = require('../middleware/upload');

/**
 * @route POST /api/babies
 * @desc Create new baby profile
 * @access Private
 */
router.post('/', 
  profileUpdateRateLimit, 
  authenticate, 
  sanitizeInput, 
  securityLogger, 
  validateCreateBaby,
  handleValidationErrors,
  babyController.createBaby
);

/**
 * @route GET /api/babies
 * @desc Get all baby profiles for authenticated user
 * @access Private
 */
router.get('/', 
  profileRateLimit, 
  authenticate, 
  securityLogger, 
  babyController.getAllBabies
);

/**
 * @route GET /api/babies/:id
 * @desc Get specific baby profile by ID
 * @access Private
 */
router.get('/:id', 
  profileRateLimit, 
  authenticate, 
  requireBabyOwnership,
  securityLogger, 
  babyController.getBabyById
);

/**
 * @route PUT /api/babies/:id
 * @desc Update baby profile
 * @access Private
 */
router.put('/:id', 
  profileUpdateRateLimit, 
  authenticate, 
  requireBabyOwnership,
  sanitizeInput, 
  securityLogger, 
  validateUpdateBaby,
  handleValidationErrors,
  babyController.updateBaby
);

/**
 * @route DELETE /api/babies/:id
 * @desc Delete baby profile (soft delete)
 * @access Private
 */
router.delete('/:id', 
  profileUpdateRateLimit, 
  authenticate, 
  requireBabyOwnership,
  securityLogger, 
  babyController.deleteBaby
);

/**
 * @route POST /api/babies/:id/upload-photo
 * @desc Upload baby photo
 * @access Private
 */
router.post('/:id/upload-photo', 
  profileUpdateRateLimit, 
  authenticate, 
  requireBabyOwnership,
  uploadBabyPhoto,
  handleUploadError,
  securityLogger, 
  babyController.uploadBabyPhoto
);

/**
 * @route DELETE /api/babies/:id/photo
 * @desc Delete baby photo
 * @access Private
 */
router.delete('/:id/photo', 
  profileUpdateRateLimit, 
  authenticate, 
  requireBabyOwnership,
  securityLogger, 
  babyController.deleteBabyPhoto
);

module.exports = router; 