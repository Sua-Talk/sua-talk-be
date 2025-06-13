const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { authenticate, requireActiveAccount } = require('../middleware/auth');
const { securityLogger } = require('../middleware/security');
const {
  validateRecordingId,
  validateUserId,
  validateMLHistoryQuery,
  validateMLAnalysisTrigger,
  validateDirectMLAnalysis
} = require('../middleware/mlValidation');
const {
  getMLServiceStatus,
  getMLClasses,
  directMLAnalysis,
  triggerMLAnalysis,
  getMLAnalysisResult,
  getMLAnalysisHistory,
  getMLAnalysisStats
} = require('../controllers/mlController');

const router = express.Router();

// Configure multer for direct audio upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/flac'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

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
 * GET /api/ml/classes
 * Get available classification classes
 */
router.get('/classes', getMLClasses);

// Protected endpoints (authentication required)

/**
 * POST /api/ml/analyzes
 * Direct ML analysis with audio file upload
 */
router.post('/analyzes',
  mlAnalysisLimiter,
  authenticate,
  requireActiveAccount,
  upload.single('audio'),
  validateDirectMLAnalysis,
  securityLogger,
  directMLAnalysis
);

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