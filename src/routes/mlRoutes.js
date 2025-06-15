const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireActiveAccount } = require('../middleware/auth');
const { securityLogger } = require('../middleware/security');
const {
  validateRecordingId,
  validateUserId,
  validateMLHistoryQuery,
  validateMLAnalysisTrigger
} = require('../middleware/mlValidation');
const {
  getMLServiceStatus,
  getMLClasses,
  triggerMLAnalysis,
  getMLAnalysisResult,
  getMLAnalysisHistory,
  getMLAnalysisStats,
  resetCircuitBreaker
} = require('../controllers/mlController');

const router = express.Router();

// Rate limiting for ML operations
const mlAnalysisLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 analysis requests per user per 5 minutes
  message: {
    success: false,
    message: 'Too many analysis requests. Please try again in 5 minutes.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

const mlQueryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 query requests per user per minute
  message: {
    success: false,
    message: 'Too many requests. Please try again in 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Public endpoints (no authentication required)

/**
 * GET /api/ml/status
 * Get ML service health status
 */
router.get('/status', getMLServiceStatus);

/**
 * POST /api/ml/reset-circuit
 * Reset circuit breaker and test ML service connection (development/debugging only)
 */
router.post('/reset-circuit', resetCircuitBreaker);

/**
 * GET /api/ml/classes
 * Get available classification classes
 */
router.get('/classes', getMLClasses);

// Protected endpoints (authentication required)

/**
 * POST /api/ml/analyze/:recordingId
 * Trigger ML analysis for a specific audio recording
 */
router.post('/analyze/:recordingId', 
  mlAnalysisLimiter,
  authenticate,
  requireActiveAccount,
  validateMLAnalysisTrigger,
  securityLogger,
  triggerMLAnalysis
);

/**
 * GET /api/ml/analysis/:recordingId
 * Get ML analysis result for a specific recording
 */
router.get('/analysis/:recordingId',
  mlQueryLimiter,
  authenticate,
  requireActiveAccount,
  validateRecordingId,
  getMLAnalysisResult
);

/**
 * GET /api/ml/history/:userId
 * Get ML analysis history for a user
 */
router.get('/history/:userId',
  mlQueryLimiter,
  authenticate,
  requireActiveAccount,
  validateUserId,
  validateMLHistoryQuery,
  getMLAnalysisHistory
);

/**
 * GET /api/ml/stats/:userId
 * Get ML analysis statistics for a user
 */
router.get('/stats/:userId',
  mlQueryLimiter,
  authenticate,
  requireActiveAccount,
  validateUserId,
  getMLAnalysisStats
);

module.exports = router; 