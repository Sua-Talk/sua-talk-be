const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * ML Validation Middleware
 * Validation rules for ML service endpoints
 */

/**
 * Validate MongoDB ObjectId parameter
 */
const validateObjectId = (paramName, fieldName = 'ID') => {
  return param(paramName)
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${fieldName} format`);
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

module.exports = {
  validateRecordingId,
  validateUserId,
  validateMLHistoryQuery,
  validateMLAnalysisTrigger,
  validateObjectId
}; 