const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const { authenticate } = require('../middleware/auth');
const { validateObjectId, validateAudioRecordingsQuery, validateAudioUpload } = require('../middleware/validation');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { body } = require('express-validator');
const { 
  profileRateLimit, 
  profileUpdateRateLimit 
} = require('../middleware/rateLimiting');
const { 
  sanitizeInput, 
  securityLogger 
} = require('../middleware/security');
const { 
  uploadAudioRecording, 
  handleUploadError 
} = require('../middleware/upload');

/**
 * @route POST /api/audio/upload
 * @desc Upload audio recording for a baby
 * @access Private
 */
router.post('/upload',
  authenticate,
  // Debug middleware to log request details
  (req, res, next) => {
    console.log('🚀 === ROUTE MIDDLEWARE DEBUG ===');
    console.log('📍 Route: POST /audio/upload');
    console.log('📊 Headers:', req.headers);
    console.log('📦 Body (before upload):', req.body);
    console.log('🔒 User authenticated:', !!req.user);
    console.log('🚀 === PROCEEDING TO UPLOAD MIDDLEWARE ===');
    next();
  },
  uploadAudioRecording,
  // Debug middleware after upload
  (req, res, next) => {
    console.log('✅ === POST-UPLOAD MIDDLEWARE DEBUG ===');
    console.log('📁 File processed:', !!req.file);
    console.log('📝 Body (after upload):', req.body);
    console.log('✅ === PROCEEDING TO CONTROLLER ===');
    next();
  },
  validateAudioUpload,
  handleValidationErrors,
  profileRateLimit,
  sanitizeInput,
  securityLogger,
  audioController.uploadAudioRecording,
  handleUploadError
);

/**
 * @route GET /api/audio/recordings
 * @desc Get all audio recordings for authenticated user
 * @access Private
 * @query babyId - Filter by baby ID (optional)
 * @query status - Filter by analysis status (optional)
 * @query page - Page number for pagination (default: 1)
 * @query limit - Records per page (default: 20, max: 50)
 */
router.get('/recordings', 
  profileRateLimit, 
  authenticate, 
  validateAudioRecordingsQuery,
  handleValidationErrors,
  securityLogger, 
  audioController.getAllRecordings
);

/**
 * @route GET /api/audio/recordings/:id
 * @desc Get specific audio recording by ID
 * @access Private
 */
router.get('/recordings/:id', 
  profileRateLimit, 
  authenticate, 
  validateObjectId('id'),
  handleValidationErrors,
  securityLogger, 
  audioController.getRecordingById
);

/**
 * @route DELETE /api/audio/recordings/:id
 * @desc Delete audio recording and associated file
 * @access Private
 */
router.delete('/recordings/:id', 
  profileUpdateRateLimit, 
  authenticate, 
  validateObjectId('id'),
  handleValidationErrors,
  securityLogger, 
  audioController.deleteRecording
);

/**
 * @route GET /api/audio/pending-analysis
 * @desc Get pending ML analysis recordings for user
 * @access Private
 */
router.get('/pending-analysis', 
  profileRateLimit, 
  authenticate, 
  securityLogger, 
  audioController.getPendingAnalysisRecordings
);

/**
 * @route POST /api/audio/batch-analyze
 * @desc Trigger ML analysis for multiple recordings
 * @access Private
 * @body recordingIds - Array of recording IDs to analyze (optional)
 * @body analyzeAllPending - Boolean to analyze all pending recordings (optional)
 */
router.post('/batch-analyze', 
  profileUpdateRateLimit, 
  authenticate,
  [
    body('recordingIds')
      .optional()
      .isArray()
      .withMessage('recordingIds must be an array')
      .custom((recordingIds) => {
        if (recordingIds && recordingIds.length > 20) {
          throw new Error('Cannot analyze more than 20 recordings at once');
        }
        return true;
      }),
    body('analyzeAllPending')
      .optional()
      .isBoolean()
      .withMessage('analyzeAllPending must be a boolean value')
  ],
  handleValidationErrors,
  securityLogger, 
  audioController.batchTriggerAnalysis
);

/**
 * @route POST /api/audio/cleanup
 * @desc Cleanup orphaned audio files (maintenance endpoint)
 * @access Private
 * @note This could be restricted to admin users in the future
 */
router.post('/cleanup', 
  profileUpdateRateLimit, 
  authenticate, 
  securityLogger, 
  audioController.cleanupAudioFiles
);

/**
 * @route OPTIONS /api/audio/stream/:id
 * @desc Handle preflight CORS requests for audio streaming
 * @access Public
 */
router.options('/stream/:id', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173',
    'https://suatalk.site',
    'https://www.suatalk.site',
    'https://api.suatalk.site'  // Add API domain for Swagger UI
  ];
  
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  res.set({
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  
  res.status(204).end();
});

/**
 * @route GET /api/audio/stream/:id
 * @desc Stream audio file with CORS support
 * @access Private
 */
router.get('/stream/:id', 
  profileRateLimit, 
  authenticate, 
  validateObjectId('id'),
  handleValidationErrors,
  securityLogger, 
  audioController.streamAudio
);

/**
 * @route OPTIONS /api/audio/stream-url/:id
 * @desc Handle preflight CORS requests for stream-url
 * @access Public
 */
router.options('/stream-url/:id', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173',
    'https://suatalk.site',
    'https://www.suatalk.site',
    'https://api.suatalk.site'  // Add API domain for Swagger UI
  ];
  
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  res.set({
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400'
  });
  
  res.status(204).end();
});

/**
 * @route GET /api/audio/stream-url/:id
 * @desc Get streaming URL for audio file (CORS-friendly, no redirect)
 * @access Private
 */
router.get('/stream-url/:id', 
  profileRateLimit, 
  authenticate, 
  validateObjectId('id'),
  handleValidationErrors,
  securityLogger, 
  audioController.getStreamUrl
);

module.exports = router; 