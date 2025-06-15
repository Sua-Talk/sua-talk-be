const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import storage configuration based on environment
let storageConfig = null;
let useLocalStorage = false;

if (process.env.NODE_ENV === 'production') {
  try {
    storageConfig = require('../config/storage');
    console.log('✅ Production storage (Minio) configuration loaded');
  } catch (error) {
    console.error('❌ Failed to load Minio storage configuration:', error.message);
    console.warn('🔄 Falling back to local storage for production');
    useLocalStorage = true;
  }
} else {
  useLocalStorage = true;
  console.log('🔧 Using local storage for development');
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const babyPhotosDir = path.join(uploadsDir, 'baby-photos');
const audioRecordingsDir = path.join(uploadsDir, 'audio-recordings');
const avatarsDir = path.join(uploadsDir, 'avatars');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(babyPhotosDir)) {
  fs.mkdirSync(babyPhotosDir, { recursive: true });
}

if (!fs.existsSync(audioRecordingsDir)) {
  fs.mkdirSync(audioRecordingsDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Configure multer storage for baby photos
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, babyPhotosDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: baby-{babyId}-{timestamp}.{extension}
    const babyId = req.params.id;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `baby-${babyId}-${timestamp}${extension}`;
    cb(null, filename);
  }
});

// Configure multer storage for audio recordings
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioRecordingsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: audio-{userId}-{timestamp}.{extension}
    const userId = req.user._id;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `audio-${userId}-${timestamp}${extension}`;
    cb(null, filename);
  }
});

// Configure multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: avatar-{userId}-{timestamp}.{extension}
    const userId = req.user._id;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `avatar-${userId}-${timestamp}${extension}`;
    cb(null, filename);
  }
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// File filter for audio files
const audioFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 
    'audio/wave', 'audio/x-wave', 'audio/webm', 'audio/ogg'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP3, WAV, WebM, and OGG audio files are allowed.'), false);
  }
};

// Configure multer for baby photos
const photoUpload = multer({
  storage: photoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
    fields: 10, // Maximum number of non-file fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 100, // 100KB for field values
    parts: 15, // Maximum number of multipart parts
    headerPairs: 2000 // Maximum number of header key=>value pairs
  },
  onError: (err, next) => {
    console.error('Multer photo upload error:', err);
    next(err);
  }
});

// Configure multer for audio recordings
const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
    files: 1, // Only one file at a time
    fields: 10, // Maximum number of non-file fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 1024, // 1MB for field values
    parts: 20, // Maximum number of multipart parts
    headerPairs: 2000 // Maximum number of header key=>value pairs
  },
  // Add error handling for partial uploads
  onError: (err, next) => {
    console.error('Multer audio upload error:', err);
    next(err);
  }
});

// Configure multer for user avatars
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
    fields: 5, // Maximum number of non-file fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 50, // 50KB for field values
    parts: 10, // Maximum number of multipart parts
    headerPairs: 2000 // Maximum number of header key=>value pairs
  },
  onError: (err, next) => {
    console.error('Multer avatar upload error:', err);
    next(err);
  }
});

// Middleware for file uploads with error handling
const createUploadMiddleware = (cloudUploadFn, localUploadFn, type) => {
  return (req, res, next) => {
    // Add timeout handling for upload
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        return res.status(408).json({
          success: false,
          message: 'Upload timeout. Please try again.',
          error: 'UPLOAD_TIMEOUT'
        });
      }
    }, 30000); // 30 second timeout

    const clearTimeoutAndNext = (error) => {
      clearTimeout(timeout);
      if (error) {
        // Handle specific busboy errors
        if (error.message && error.message.includes('Unexpected end of form')) {
          return res.status(400).json({
            success: false,
            message: 'Upload was interrupted. Please try again.',
            error: 'FORM_INCOMPLETE'
          });
        }
        return next(error);
      }
      next();
    };

    // Try cloud storage first, fall back to local on error
    if (!useLocalStorage && storageConfig) {
      try {
        return cloudUploadFn(req, res, (error) => {
          if (error) {
            console.error(`❌ Cloud storage error for ${type}:`, error.message);
            console.warn(`🔄 Falling back to local storage for ${type}`);
            
            // Fallback to local storage
            return localUploadFn(req, res, clearTimeoutAndNext);
          }
          clearTimeoutAndNext();
        });
      } catch (error) {
        console.error(`❌ Cloud storage initialization error for ${type}:`, error.message);
        console.warn(`🔄 Using local storage for ${type}`);
        return localUploadFn(req, res, clearTimeoutAndNext);
      }
    } else {
      // Use local storage
      return localUploadFn(req, res, clearTimeoutAndNext);
    }
  };
};

// Export upload middleware with fallback
const uploadBabyPhoto = createUploadMiddleware(
  storageConfig ? storageConfig.uploadBabyPhoto : null,
  photoUpload.single('photo'),
  'baby photo'
);

const uploadAudioRecording = createUploadMiddleware(
  storageConfig ? storageConfig.uploadAudioRecording : null,
  audioUpload.single('audio'),
  'audio recording'
);

const uploadAvatar = createUploadMiddleware(
  storageConfig ? storageConfig.uploadAvatar : null,
  avatarUpload.single('avatar'),
  'avatar'
);

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  // Handle busboy errors specifically
  if (error.message && error.message.includes('Unexpected end of form')) {
    return res.status(400).json({
      success: false,
      message: 'Upload was interrupted or form data is incomplete. Please try again.',
      error: 'FORM_INCOMPLETE'
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const isAudioUpload = req.route?.path?.includes('audio');
      const maxSize = isAudioUpload ? '50MB' : '5MB';
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${maxSize}.`,
        error: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file is allowed.',
        error: 'TOO_MANY_FILES'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      const isAudioUpload = req.route?.path?.includes('audio');
      const expectedField = isAudioUpload ? 'audio' : 'photo';
      return res.status(400).json({
        success: false,
        message: `Unexpected field name. Use "${expectedField}" as the field name.`,
        error: 'UNEXPECTED_FIELD'
      });
    }

    if (error.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many form fields.',
        error: 'TOO_MANY_FIELDS'
      });
    }

    if (error.code === 'LIMIT_FIELD_KEY') {
      return res.status(400).json({
        success: false,
        message: 'Field name too long.',
        error: 'FIELD_NAME_TOO_LONG'
      });
    }

    if (error.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({
        success: false,
        message: 'Field value too long.',
        error: 'FIELD_VALUE_TOO_LONG'
      });
    }

    if (error.code === 'LIMIT_FIELD_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many fields.',
        error: 'TOO_MANY_FIELDS'
      });
    }
  }
  
  if (error.message.includes('Invalid file type') || 
      error.message.includes('Only image files') ||
      error.message.includes('Only audio files') ||
      error.message.includes('Invalid audio file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE_TYPE'
    });
  }

  // Handle connection errors
  if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
    return res.status(400).json({
      success: false,
      message: 'Upload connection was interrupted. Please try again.',
      error: 'CONNECTION_INTERRUPTED'
    });
  }
  
  // Log unhandled errors for debugging
  console.error('Unhandled upload error:', error);
  
  // Pass other errors to the next error handler
  next(error);
};

module.exports = {
  uploadBabyPhoto,
  uploadAudioRecording,
  uploadAvatar,
  handleUploadError,
  // Export local uploads for direct use if needed
  localUploads: {
    photoUpload: photoUpload.single('photo'),
    audioUpload: audioUpload.single('audio'),
    avatarUpload: avatarUpload.single('avatar')
  }
}; 