const express = require('express');
const router = express.Router();

const {
  createAPIKey,
  listAPIKeys,
  getAPIKey,
  updateAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  getAPIKeyStats,
  rotateAPIKey
} = require('../controllers/apiKeyController');

const {
  validateCreateAPIKey,
  validateUpdateAPIKey,
  validateAPIKeyId,
  validateListAPIKeys
} = require('../middleware/apiKeyValidation');

const { authenticate } = require('../middleware/auth');
const { hybridAuth, requirePermission } = require('../middleware/apiKeyAuth');
const { profileRateLimit } = require('../middleware/rateLimiting');

// All routes require authentication (JWT or API key)
router.use(hybridAuth(authenticate));

/**
 * @route   POST /api/keys
 * @desc    Create a new API key
 * @access  Private (User or Admin)
 */
router.post('/',
  profileRateLimit, // Rate limit API key creation
  validateCreateAPIKey,
  createAPIKey
);

/**
 * @route   GET /api/keys
 * @desc    List API keys
 * @access  Private (User sees own keys, Admin sees all)
 */
router.get('/',
  validateListAPIKeys,
  listAPIKeys
);

/**
 * @route   GET /api/keys/stats
 * @desc    Get API key usage statistics
 * @access  Private
 */
router.get('/stats',
  getAPIKeyStats
);

/**
 * @route   GET /api/keys/:id
 * @desc    Get API key details by ID
 * @access  Private (Owner or Admin)
 */
router.get('/:id',
  validateAPIKeyId,
  getAPIKey
);

/**
 * @route   PUT /api/keys/:id
 * @desc    Update API key
 * @access  Private (Owner or Admin)
 */
router.put('/:id',
  profileRateLimit, // Rate limit updates
  validateUpdateAPIKey,
  updateAPIKey
);

/**
 * @route   POST /api/keys/:id/rotate
 * @desc    Rotate API key (generate new key)
 * @access  Private (Owner or Admin)
 */
router.post('/:id/rotate',
  profileRateLimit, // Rate limit key rotation
  validateAPIKeyId,
  rotateAPIKey
);

/**
 * @route   POST /api/keys/:id/revoke
 * @desc    Revoke (deactivate) API key
 * @access  Private (Owner or Admin)
 */
router.post('/:id/revoke',
  profileRateLimit, // Rate limit revocation
  validateAPIKeyId,
  revokeAPIKey
);

/**
 * @route   DELETE /api/keys/:id
 * @desc    Delete API key permanently
 * @access  Private (Owner or Admin)
 */
router.delete('/:id',
  profileRateLimit, // Rate limit deletion
  validateAPIKeyId,
  deleteAPIKey
);

module.exports = router; 