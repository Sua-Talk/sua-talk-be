const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * ML Validation Middleware
 * Validation rules for ML service endpoints
 */

/**
 * Validate ObjectId parameter
 */
const validateObjectId = (paramName, fieldName) => {
  return param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`${fieldName} must be a valid ObjectId`);
      }
      return true;
    });
};

/**
 * Validate recording ID parameter
 */
const validateRecordingId = [
  validateObjectId('recordingId', 'Recording ID')
];

/**
 * Validate user ID parameter
 */
const validateUserId = [
  validateObjectId('userId', 'User ID')
];

/**
 * Validate ML analysis history query parameters
 */
const validateMLHistoryQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed'])
    .withMessage('Status must be one of: pending, processing, completed, failed'),
  
  query('prediction')
    .optional()
    .isIn(['burping', 'discomfort', 'belly_pain', 'hungry', 'tired'])
    .withMessage('Prediction must be one of: burping, discomfort, belly_pain, hungry, tired'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'analyzedAt', 'confidence', 'filename'])
    .withMessage('SortBy must be one of: createdAt, analyzedAt, confidence, filename'),
  
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be either asc or desc')
];

/**
 * Validate ML analysis trigger request
 */
const validateMLAnalysisTrigger = [
  validateObjectId('recordingId', 'Recording ID'),
  
  // Optional body parameters for future use
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be one of: low, medium, high'),
  
  body('forceReprocess')
    .optional()
    .isBoolean()
    .withMessage('ForceReprocess must be a boolean value')
    .toBoolean()
];

/**
 * Validate direct ML analysis request with file upload
 */
const validateDirectMLAnalysis = [
  body('date_of_birth')
    .notEmpty()
    .withMessage('date_of_birth is required')
    .isISO8601()
    .withMessage('date_of_birth must be a valid ISO 8601 date string')
    .custom((value) => {
      const birthDate = new Date(value);
      const now = new Date();
      const maxAge = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      
      if (birthDate > now) {
        throw new Error('date_of_birth cannot be in the future');
      }
      
      if (birthDate < maxAge) {
        throw new Error('Baby cannot be older than 5 years');
      }
      
      return true;
    }),
  
  body('baby_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('baby_id must be a valid ObjectId');
      }
      return true;
    }),
  
  body('history_data')
    .optional()
    .custom((value) => {
      if (value) {
        try {
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            JSON.parse(value);
          } else if (!Array.isArray(value)) {
            throw new Error('history_data must be an array or valid JSON string array');
          }
        } catch (error) {
          throw new Error('history_data must be valid JSON array format');
        }
      }
      return true;
    })
];

module.exports = {
  validateRecordingId,
  validateUserId,
  validateMLHistoryQuery,
  validateMLAnalysisTrigger,
  validateDirectMLAnalysis,
  validateObjectId
}; 