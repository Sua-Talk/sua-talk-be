const { body, param, query } = require('express-validator');

// User Registration Validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  

];

// Email Verification Validation
const validateEmailVerification = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('code')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers')
];

// Resend Verification Email Validation
const validateResendVerification = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Login Validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Forgot Password Validation
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Reset Password Validation
const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)')
];

// Change Password Validation
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// Refresh Token Validation
const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Update Profile Validation
const validateUpdateProfile = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please enter a valid phone number (E.164 format)')
];

// Delete Account Validation
const validateDeleteAccount = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),
  
  body('confirmDelete')
    .equals('DELETE')
    .withMessage('Please type "DELETE" to confirm account deletion')
];

// Baby Profile Validation
const validateCreateBaby = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Baby name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Baby name can only contain letters and spaces'),
  
  body('birthDate')
    .isISO8601()
    .withMessage('Please provide a valid birth date in ISO 8601 format')
    .custom((value) => {
      const birthDate = new Date(value);
      const now = new Date();
      const minDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      
      if (birthDate > now) {
        throw new Error('Birth date cannot be in the future');
      }
      
      if (birthDate < minDate) {
        throw new Error('Baby cannot be older than 5 years');
      }
      
      return true;
    }),
  
  body('gender')
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Gender must be one of: male, female, other, prefer-not-to-say'),
  
  body('weight.birth')
    .optional()
    .isFloat({ min: 500, max: 8000 })
    .withMessage('Birth weight must be between 500g and 8000g'),
  
  body('weight.current')
    .optional()
    .isFloat({ min: 500, max: 50000 })
    .withMessage('Current weight must be between 500g and 50kg'),
  
  body('height.birth')
    .optional()
    .isFloat({ min: 20, max: 80 })
    .withMessage('Birth height must be between 20cm and 80cm'),
  
  body('height.current')
    .optional()
    .isFloat({ min: 20, max: 200 })
    .withMessage('Current height must be between 20cm and 200cm'),
  
  body('feedingNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feeding notes cannot exceed 500 characters'),
  
  body('sleepNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Sleep notes cannot exceed 500 characters'),
  
  body('allergies')
    .optional()
    .isArray()
    .withMessage('Allergies must be an array'),
  
  body('allergies.*')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each allergy description cannot exceed 100 characters'),
  
  body('medications')
    .optional()
    .isArray()
    .withMessage('Medications must be an array'),
  
  body('medications.*.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Medication name must be between 1 and 100 characters'),
  
  body('medications.*.dosage')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Medication dosage cannot exceed 50 characters'),
  
  body('medications.*.frequency')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Medication frequency cannot exceed 50 characters')
];

// Baby Profile Update Validation (all fields optional)
const validateUpdateBaby = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Baby name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Baby name can only contain letters and spaces'),
  
  body('birthDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid birth date in ISO 8601 format')
    .custom((value) => {
      const birthDate = new Date(value);
      const now = new Date();
      const minDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      
      if (birthDate > now) {
        throw new Error('Birth date cannot be in the future');
      }
      
      if (birthDate < minDate) {
        throw new Error('Baby cannot be older than 5 years');
      }
      
      return true;
    }),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Gender must be one of: male, female, other, prefer-not-to-say'),
  
  body('weight.birth')
    .optional()
    .isFloat({ min: 500, max: 8000 })
    .withMessage('Birth weight must be between 500g and 8000g'),
  
  body('weight.current')
    .optional()
    .isFloat({ min: 500, max: 50000 })
    .withMessage('Current weight must be between 500g and 50kg'),
  
  body('height.birth')
    .optional()
    .isFloat({ min: 20, max: 80 })
    .withMessage('Birth height must be between 20cm and 80cm'),
  
  body('height.current')
    .optional()
    .isFloat({ min: 20, max: 200 })
    .withMessage('Current height must be between 20cm and 200cm'),
  
  body('feedingNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feeding notes cannot exceed 500 characters'),
  
  body('sleepNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Sleep notes cannot exceed 500 characters'),
  
  body('allergies')
    .optional()
    .isArray()
    .withMessage('Allergies must be an array'),
  
  body('allergies.*')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each allergy description cannot exceed 100 characters'),
  
  body('medications')
    .optional()
    .isArray()
    .withMessage('Medications must be an array'),
  
  body('medications.*.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Medication name must be between 1 and 100 characters'),
  
  body('medications.*.dosage')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Medication dosage cannot exceed 50 characters'),
  
  body('medications.*.frequency')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Medication frequency cannot exceed 50 characters')
];

// MongoDB ObjectId validation function
const validateObjectId = (paramName = 'id') => {
  return param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}: must be a valid MongoDB ObjectId`);
};

// Query parameter validation for audio recordings
const validateAudioRecordingsQuery = [
  query('babyId')
    .optional()
    .isMongoId()
    .withMessage('Invalid babyId: must be a valid MongoDB ObjectId'),
  
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed'])
    .withMessage('Status must be one of: pending, processing, completed, failed'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt()
];

// Query parameter validation for OAuth redirect
const validateOAuthQuery = [
  query('redirect')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Redirect must be a valid URL with http or https protocol')
    .isLength({ max: 500 })
    .withMessage('Redirect URL cannot exceed 500 characters')
];

module.exports = {
  validateRegistration,
  validateEmailVerification,
  validateResendVerification,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateRefreshToken,
  validateUpdateProfile,
  validateDeleteAccount,
  validateCreateBaby,
  validateUpdateBaby,
  validateObjectId,
  validateAudioRecordingsQuery,
  validateOAuthQuery
}; 