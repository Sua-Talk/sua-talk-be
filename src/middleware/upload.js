const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileStorageService = require('../services/fileStorage');

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
    const userId = req.user.userId;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `audio-${userId}-${timestamp}-${randomSuffix}${extension}`;
    cb(null, filename);
  }
});

// Configure multer storage for user avatars
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

// File filter for images with enhanced validation
const imageFileFilter = async (req, file, cb) => {
  try {
    // Check if file is an image by MIME type
    if (file.mimetype.startsWith('image/')) {
      // Allowed image types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
      }
    } else {
      cb(new Error('Only image files are allowed.'), false);
    }
  } catch (error) {
    cb(new Error('File validation failed.'), false);
  }
};

// File filter for audio files with enhanced validation
const audioFileFilter = async (req, file, cb) => {
  try {
    // Check if file is an audio file by MIME type
    if (file.mimetype.startsWith('audio/')) {
      // Allowed audio types
      const allowedTypes = [
        'audio/wav',
        'audio/mp3', 
        'audio/mpeg',
        'audio/m4a',
        'audio/flac',
        'audio/wave',
        'audio/x-wav'
      ];
      
      // Also check by file extension as backup
      const extension = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.wav', '.mp3', '.m4a', '.flac'];
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid audio file type. Only WAV, MP3, M4A, and FLAC files are allowed.'), false);
      }
    } else {
      cb(new Error('Only audio files are allowed.'), false);
    }
  } catch (error) {
    cb(new Error('Audio file validation failed.'), false);
  }
};

// Configure multer for baby photos
const photoUpload = multer({
  storage: photoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  }
});

// Configure multer for audio recordings
const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
    files: 1 // Only one file at a time
  }
});

// Configure multer for user avatars
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  }
});

// Middleware for single photo upload
const uploadBabyPhoto = photoUpload.single('photo');

// Middleware for single audio upload
const uploadAudioRecording = audioUpload.single('audio');

// Middleware for single avatar upload
const uploadAvatar = avatarUpload.single('avatar');

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
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
  
  // Pass other errors to the next error handler
  next(error);
};

// Utility function to generate unique audio filename
const generateAudioFilename = (userId, originalname) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const extension = path.extname(originalname).toLowerCase();
  return `audio-${userId}-${timestamp}-${randomSuffix}${extension}`;
};

// Utility function to get file extension from mimetype
const getExtensionFromMimetype = (mimetype) => {
  const mimetypeMap = {
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-wav': '.wav',
    'audio/mp3': '.mp3',
    'audio/mpeg': '.mp3',
    'audio/m4a': '.m4a',
    'audio/flac': '.flac'
  };
  return mimetypeMap[mimetype] || '.mp3'; // Default to .mp3
};

module.exports = {
  uploadBabyPhoto,
  uploadAudioRecording,
  uploadAvatar,
  handleUploadError,
  uploadsDir,
  babyPhotosDir,
  audioRecordingsDir,
  avatarsDir,
  generateAudioFilename,
  getExtensionFromMimetype
}; 