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

// Middleware for file uploads with error handling
const createUploadMiddleware = (cloudUploadFn, localUploadFn, type) => {
  return (req, res, next) => {
    // Try cloud storage first, fall back to local on error
    if (!useLocalStorage && storageConfig) {
      try {
        return cloudUploadFn(req, res, (error) => {
          if (error) {
            console.error(`❌ Cloud storage error for ${type}:`, error.message);
            console.warn(`🔄 Falling back to local storage for ${type}`);
            
            // Fallback to local storage
            return localUploadFn(req, res, next);
          }
          next();
        });
      } catch (error) {
        console.error(`❌ Cloud storage initialization error for ${type}:`, error.message);
        console.warn(`🔄 Using local storage for ${type}`);
        return localUploadFn(req, res, next);
      }
    } else {
      // Use local storage
      return localUploadFn(req, res, next);
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

module.exports = {
  uploadBabyPhoto,
  uploadAudioRecording,
  uploadAvatar,
  // Export local uploads for direct use if needed
  localUploads: {
    photoUpload: photoUpload.single('photo'),
    audioUpload: audioUpload.single('audio'),
    avatarUpload: avatarUpload.single('avatar')
  }
}; 