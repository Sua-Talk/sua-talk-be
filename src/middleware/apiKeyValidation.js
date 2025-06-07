const { body, param, query } = require('express-validator');

// Validation for creating API key
const validateCreateAPIKey = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission is required')
    .custom((permissions) => {
      const validPermissions = [
        'ml:read',
        'ml:write', 
        'audio:read',
        'audio:write',
        'users:read',
        'admin:manage',
        'internal:service'
      ];
      
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
      
      return true;
    }),
  
  body('type')
    .optional()
    .isIn(['user', 'service', 'admin'])
    .withMessage('Type must be one of: user, service, admin'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
    .custom((expiresAt) => {
      const date = new Date(expiresAt);
      if (date <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
  
  body('allowedIPs')
    .optional()
    .isArray()
    .withMessage('Allowed IPs must be an array')
    .custom((ips) => {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      for (const ip of ips) {
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip) && ip !== 'localhost') {
          throw new Error(`Invalid IP address: ${ip}`);
        }
      }
      return true;
    }),
  
  body('rateLimitPerHour')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Rate limit per hour must be between 1 and 100000'),
  
  body('rateLimitPerDay')
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Rate limit per day must be between 1 and 1000000')
];

// Validation for updating API key
const validateUpdateAPIKey = [
  param('id')
    .isMongoId()
    .withMessage('Invalid API key ID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('permissions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one permission is required')
    .custom((permissions) => {
      const validPermissions = [
        'ml:read',
        'ml:write',
        'audio:read', 
        'audio:write',
        'users:read',
        'admin:manage',
        'internal:service'
      ];
      
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
      
      return true;
    }),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
    .custom((expiresAt) => {
      if (expiresAt) {
        const date = new Date(expiresAt);
        if (date <= new Date()) {
          throw new Error('Expiration date must be in the future');
        }
      }
      return true;
    }),
  
  body('allowedIPs')
    .optional()
    .isArray()
    .withMessage('Allowed IPs must be an array')
    .custom((ips) => {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      for (const ip of ips) {
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip) && ip !== 'localhost') {
          throw new Error(`Invalid IP address: ${ip}`);
        }
      }
      return true;
    }),
  
  body('rateLimitPerHour')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Rate limit per hour must be between 1 and 100000'),
  
  body('rateLimitPerDay')
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Rate limit per day must be between 1 and 1000000')
];

// Validation for API key ID parameter
const validateAPIKeyId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid API key ID')
];

// Validation for listing API keys
const validateListAPIKeys = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('type')
    .optional()
    .isIn(['user', 'service', 'admin'])
    .withMessage('Type must be one of: user, service, admin'),
  
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

module.exports = {
  validateCreateAPIKey,
  validateUpdateAPIKey,
  validateAPIKeyId,
  validateListAPIKeys
}; 