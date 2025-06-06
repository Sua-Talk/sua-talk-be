const mongoose = require('mongoose');

// Custom error classes
class DatabaseError extends Error {
  constructor(message, originalError = null, statusCode = 500) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends DatabaseError {
  constructor(message, validationErrors = {}, originalError = null) {
    super(message, originalError, 400);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

class DuplicateKeyError extends DatabaseError {
  constructor(message, field, value, originalError = null) {
    super(message, originalError, 409);
    this.name = 'DuplicateKeyError';
    this.field = field;
    this.value = value;
  }
}

class NotFoundError extends DatabaseError {
  constructor(message, model = null, query = null, originalError = null) {
    super(message, originalError, 404);
    this.name = 'NotFoundError';
    this.model = model;
    this.query = query;
  }
}

class ConnectionError extends DatabaseError {
  constructor(message, originalError = null) {
    super(message, originalError, 503);
    this.name = 'ConnectionError';
  }
}

// Error handling functions
const handleValidationError = (error) => {
  const validationErrors = {};
  
  if (error.errors) {
    Object.keys(error.errors).forEach(key => {
      const err = error.errors[key];
      validationErrors[key] = {
        message: err.message,
        value: err.value,
        kind: err.kind,
        path: err.path
      };
    });
  }

  const message = 'Validation failed';
  return new ValidationError(message, validationErrors, error);
};

const handleDuplicateKeyError = (error) => {
  // Extract field and value from duplicate key error
  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};
  
  const field = Object.keys(keyPattern)[0] || 'unknown';
  const value = keyValue[field] || 'unknown';
  
  const message = `Duplicate value for field '${field}': '${value}' already exists`;
  return new DuplicateKeyError(message, field, value, error);
};

const handleCastError = (error) => {
  const message = `Invalid ${error.path}: '${error.value}' is not a valid ${error.kind}`;
  return new ValidationError(message, { [error.path]: { message, value: error.value, kind: error.kind } }, error);
};

const handleConnectionError = (error) => {
  const message = 'Database connection error';
  return new ConnectionError(message, error);
};

// Main error handler function
const handleDatabaseError = (error) => {
  // Log the original error for debugging
  console.error('📊 Database Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Handle different types of database errors
  if (error instanceof mongoose.Error.ValidationError) {
    return handleValidationError(error);
  }

  if (error.code === 11000 || error.code === 11001) {
    return handleDuplicateKeyError(error);
  }

  if (error instanceof mongoose.Error.CastError) {
    return handleCastError(error);
  }

  if (error.name === 'MongoNetworkError' || 
      error.name === 'MongoTimeoutError' || 
      error.name === 'MongoServerSelectionError') {
    return handleConnectionError(error);
  }

  // Handle custom database errors (already processed)
  if (error instanceof DatabaseError) {
    return error;
  }

  // Default database error for unhandled cases
  return new DatabaseError(
    'An unexpected database error occurred',
    error,
    500
  );
};

// Wrapper for database operations with error handling
const withErrorHandling = (operation) => {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      throw handleDatabaseError(error);
    }
  };
};

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to ensure document exists
const ensureDocumentExists = (document, model, query) => {
  if (!document) {
    throw new NotFoundError(
      `${model} not found`,
      model,
      query
    );
  }
  return document;
};

// Retry mechanism for database operations
const withRetry = (operation, maxRetries = 3, delay = 1000) => {
  return async (...args) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(...args);
      } catch (error) {
        lastError = error;
        
        // Only retry on connection errors
        if (error instanceof ConnectionError && attempt < maxRetries) {
          console.warn(`🔄 Database operation retry ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        
        // Don't retry validation or application errors
        throw error;
      }
    }
    
    throw lastError;
  };
};

// Express middleware for handling database errors
const databaseErrorMiddleware = (error, req, res, next) => {
  const dbError = handleDatabaseError(error);
  
  // Log error details
  console.error('💥 Database Error in Request:', {
    url: req.url,
    method: req.method,
    user: req.user?.id,
    error: {
      name: dbError.name,
      message: dbError.message,
      statusCode: dbError.statusCode
    },
    timestamp: new Date().toISOString()
  });

  // Send appropriate response
  const response = {
    error: true,
    message: dbError.message,
    type: dbError.name,
    timestamp: dbError.timestamp
  };

  // Include validation details for validation errors
  if (dbError instanceof ValidationError) {
    response.validationErrors = dbError.validationErrors;
  }

  // Include field info for duplicate key errors
  if (dbError instanceof DuplicateKeyError) {
    response.field = dbError.field;
  }

  // Don't expose internal details in production
  if (process.env.NODE_ENV === 'development') {
    response.stack = dbError.stack;
    response.originalError = dbError.originalError?.message;
  }

  res.status(dbError.statusCode).json(response);
};

module.exports = {
  // Error classes
  DatabaseError,
  ValidationError,
  DuplicateKeyError,
  NotFoundError,
  ConnectionError,
  
  // Error handlers
  handleDatabaseError,
  databaseErrorMiddleware,
  
  // Utilities
  withErrorHandling,
  withRetry,
  isValidObjectId,
  ensureDocumentExists
}; 