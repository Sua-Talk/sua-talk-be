const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const crypto = require('crypto');
const path = require('path');

/**
 * Minio S3 Storage Configuration for CapRover
 * Using S3-compatible storage via Minio instance
 */

// Configure S3 client for Minio with AWS SDK v2
const s3Config = {
  endpoint: process.env.MINIO_ENDPOINT || 'http://srv-captain--minio:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  s3ForcePathStyle: true, // Required for Minio
  signatureVersion: 'v4',
  region: process.env.MINIO_REGION || 'us-east-1', // Default region for Minio
  apiVersion: '2006-03-01', // Ensure AWS SDK v2 compatibility
  sslEnabled: false, // Disable SSL for internal CapRover communication
  s3DisableBodySigning: true, // Improve performance for Minio
  maxRetries: 3, // Add retry logic
  retryDelayOptions: {
    customBackoff: function(retryCount) {
      return Math.pow(2, retryCount) * 100; // Exponential backoff
    }
  },
  httpOptions: {
    timeout: 30000, // 30 second timeout
    connectTimeout: 5000 // 5 second connect timeout
  }
};

// Validate required configuration
const requiredEnvVars = ['MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required Minio environment variables: ${missingVars.join(', ')}`);
  console.error('📋 Please check CAPROVER_ENV_SETUP.md for required environment variables');
  throw new Error(`Missing Minio configuration: ${missingVars.join(', ')}`);
}

// Create S3 instance with error handling
let s3;
try {
  s3 = new AWS.S3(s3Config);
  console.log(`✅ Minio S3 client initialized`);
  console.log(`🔗 Endpoint: ${s3Config.endpoint}`);
  console.log(`🪣 Bucket: ${process.env.MINIO_BUCKET_NAME || 'suatalk-files'}`);
} catch (error) {
  console.error(`❌ Failed to initialize Minio S3 client:`, error);
  throw error;
}

// Bucket configuration
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'suatalk-files';

/**
 * Generate secure filename
 */
const generateSecureFilename = (originalName, prefix = 'file', userId = null) => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName).toLowerCase();
  
  const userPart = userId ? `-${userId}` : '';
  return `${prefix}${userPart}-${timestamp}-${randomHash}${extension}`;
};

/**
 * S3 Storage for Baby Photos with improved error handling
 */
const babyPhotoStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    try {
      const babyId = req.params.id;
      const filename = generateSecureFilename(file.originalname, 'baby', babyId);
      cb(null, `baby-photos/${filename}`);
    } catch (error) {
      console.error('Error generating baby photo key:', error);
      cb(error);
    }
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    try {
      cb(null, {
        fieldName: file.fieldname,
        userId: req.user._id.toString(),
        babyId: req.params.id || '',
        uploadDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error setting baby photo metadata:', error);
      cb(null, {}); // Continue with empty metadata
    }
  }
});

/**
 * S3 Storage for Audio Recordings with improved error handling
 */
const audioStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    try {
      const userId = req.user._id;
      const filename = generateSecureFilename(file.originalname, 'audio', userId);
      cb(null, `audio-recordings/${filename}`);
    } catch (error) {
      console.error('Error generating audio key:', error);
      cb(error);
    }
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    try {
      cb(null, {
        fieldName: file.fieldname,
        userId: req.user._id.toString(),
        uploadDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error setting audio metadata:', error);
      cb(null, {}); // Continue with empty metadata
    }
  }
});

/**
 * S3 Storage for User Avatars with improved error handling
 */
const avatarStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    try {
      const userId = req.user._id;
      const filename = generateSecureFilename(file.originalname, 'avatar', userId);
      cb(null, `avatars/${filename}`);
    } catch (error) {
      console.error('Error generating avatar key:', error);
      cb(error);
    }
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    try {
      cb(null, {
        fieldName: file.fieldname,
        userId: req.user._id.toString(),
        uploadDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error setting avatar metadata:', error);
      cb(null, {}); // Continue with empty metadata
    }
  }
});

/**
 * File filter for images
 */
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

/**
 * File filter for audio files
 */
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

/**
 * Multer configurations with improved limits and error handling
 */
const photoUpload = multer({
  storage: babyPhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 1024 * 100,
    parts: 15,
    headerPairs: 2000
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024,
    parts: 20,
    headerPairs: 2000
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fields: 5,
    fieldNameSize: 100,
    fieldSize: 1024 * 50,
    parts: 10,
    headerPairs: 2000
  }
});

/**
 * Utility functions
 */
const createBucketIfNotExists = async () => {
  try {
    console.log(`🔍 Checking if bucket ${BUCKET_NAME} exists...`);
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`✅ Bucket ${BUCKET_NAME} exists`);
  } catch (error) {
    if (error.statusCode === 404) {
      try {
        console.log(`📦 Creating bucket ${BUCKET_NAME}...`);
        await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
        console.log(`✅ Bucket ${BUCKET_NAME} created successfully`);
      } catch (createError) {
        console.error(`❌ Failed to create bucket ${BUCKET_NAME}:`, createError);
        throw createError;
      }
    } else {
      console.error(`❌ Error checking bucket ${BUCKET_NAME}:`, error);
      throw error;
    }
  }
};

const deleteFile = async (key) => {
  try {
    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
    console.log(`✅ File deleted: ${key}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error deleting file ${key}:`, error);
    return { success: false, error: error.message };
  }
};

const getFileUrl = (key, expiresIn = 3600) => {
  try {
    // For Minio with CapRover internal networking, generate signed URL
    const url = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    });
    return url;
  } catch (error) {
    console.error(`❌ Error generating file URL for ${key}:`, error);
    return null;
  }
};

const getStorageStats = async () => {
  try {
    // List objects in bucket with prefixes
    const prefixes = ['baby-photos/', 'audio-recordings/', 'avatars/'];
    const stats = {};
    
    for (const prefix of prefixes) {
      const data = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: prefix
      }).promise();
      
      const fileCount = data.Contents.length;
      const totalSize = data.Contents.reduce((sum, obj) => sum + obj.Size, 0);
      
      stats[prefix.replace('/', '')] = {
        fileCount,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    }
    
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Test Minio connection
 */
const testConnection = async () => {
  try {
    console.log(`🧪 Testing Minio connection...`);
    await s3.listBuckets().promise();
    console.log(`✅ Minio connection successful`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Minio connection failed:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  s3,
  BUCKET_NAME,
  photoUpload,
  audioUpload,
  avatarUpload,
  createBucketIfNotExists,
  deleteFile,
  getFileUrl,
  getStorageStats,
  testConnection,
  uploadBabyPhoto: photoUpload.single('photo'),
  uploadAudioRecording: audioUpload.single('audio'),
  uploadAvatar: avatarUpload.single('avatar')
}; 