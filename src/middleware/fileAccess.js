const path = require('path');
const fs = require('fs').promises;
const fileStorageService = require('../services/fileStorage');
const { sendErrorResponse } = require('./errorHandler');

/**
 * Middleware to secure file access with authentication and authorization
 */

/**
 * Check if user has access to the requested file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const secureFileAccess = async (req, res, next) => {
  try {
    // Extract file path from URL
    const requestedPath = req.path;
    const filename = path.basename(requestedPath);
    const directory = path.dirname(requestedPath).split('/').pop();

    // Map URL paths to storage directories
    const directoryMap = {
      'avatars': 'avatars',
      'baby-photos': 'babyPhotos',
      'audio-recordings': 'audioRecordings'
    };

    const storageDirectory = directoryMap[directory];
    if (!storageDirectory) {
      return sendErrorResponse(res, 404, 'File not found', 'FILE_NOT_FOUND');
    }

    // Check if file exists
    const fileInfo = await fileStorageService.getFileInfo(storageDirectory, filename);
    if (!fileInfo.exists) {
      return sendErrorResponse(res, 404, 'File not found', 'FILE_NOT_FOUND');
    }

    // For public files (like avatars), allow access without strict ownership check
    if (directory === 'avatars') {
      // Still require authentication but allow access to any avatar
      if (!req.user) {
        return sendErrorResponse(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
      }
      return next();
    }

    // For private files (baby photos, audio recordings), check ownership
    if (!req.user) {
      return sendErrorResponse(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
    }

    // Extract user/baby ID from filename to check ownership
    const filenameParts = filename.split('-');
    let ownerId = null;

    if (directory === 'baby-photos' && filenameParts.length >= 3) {
      // baby-{babyId}-{timestamp}.ext
      ownerId = filenameParts[1];
      
      // Check if user owns this baby
      const Baby = require('../models/Baby');
      const baby = await Baby.findOne({ _id: ownerId, parentId: req.user._id });
      if (!baby) {
        return sendErrorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
      }
    } else if (directory === 'audio-recordings' && filenameParts.length >= 4) {
      // audio-{userId}-{timestamp}-{random}.ext
      ownerId = filenameParts[1];
      
      // Check if user owns this audio recording
      if (ownerId !== req.user._id.toString()) {
        return sendErrorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
      }
    } else {
      // Unknown file format, deny access
      return sendErrorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
    }

    // Add security headers for file serving
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    next();

  } catch (error) {
    console.error('File access middleware error:', error);
    return sendErrorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
};

/**
 * Middleware to log file access for auditing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const logFileAccess = (req, res, next) => {
  const startTime = Date.now();
  
  // Log file access
  console.log(`📁 File access: ${req.method} ${req.path}`, {
    user: req.user ? req.user._id : 'anonymous',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Log response time when request completes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📁 File served: ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

/**
 * Rate limiting for file downloads
 */
const fileDownloadRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 file downloads per windowMs
  message: {
    success: false,
    message: 'Too many file download requests, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? `user:${req.user._id}` : `ip:${req.ip}`;
  }
});

/**
 * Middleware to handle file streaming with range support
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const streamFile = async (req, res, next) => {
  try {
    const requestedPath = req.path;
    const filename = path.basename(requestedPath);
    const directory = path.dirname(requestedPath).split('/').pop();

    // Map URL paths to storage directories
    const directoryMap = {
      'avatars': 'avatars',
      'baby-photos': 'babyPhotos',
      'audio-recordings': 'audioRecordings'
    };

    const storageDirectory = directoryMap[directory];
    const fileInfo = await fileStorageService.getFileInfo(storageDirectory, filename);

    if (!fileInfo.exists) {
      return sendErrorResponse(res, 404, 'File not found', 'FILE_NOT_FOUND');
    }

    const filePath = fileInfo.path;
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    // Handle range requests for audio/video files
    const range = req.headers.range;
    if (range && directory === 'audio-recordings') {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg' // Default, should be detected properly
      });

      const stream = require('fs').createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Regular file serving
      res.set({
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes'
      });

      const stream = require('fs').createReadStream(filePath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('File streaming error:', error);
    return sendErrorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
};

module.exports = {
  secureFileAccess,
  logFileAccess,
  fileDownloadRateLimit,
  streamFile
}; 