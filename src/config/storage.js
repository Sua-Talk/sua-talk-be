const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const crypto = require('crypto');
const path = require('path');

/**
 * Minio S3 Storage Configuration for CapRover
 * Using S3-compatible storage via Minio instance
 */

// Configure S3 client for Minio
const s3Config = {
  endpoint: process.env.MINIO_ENDPOINT || 'http://srv-captain--minio:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  s3ForcePathStyle: true, // Required for Minio
  signatureVersion: 'v4',
  region: process.env.MINIO_REGION || 'us-east-1' // Default region for Minio
};

// Create S3 instance
const s3 = new AWS.S3(s3Config);

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
 * S3 Storage for Baby Photos
 */
const babyPhotoStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    const babyId = req.params.id;
    const filename = generateSecureFilename(file.originalname, 'baby', babyId);
    cb(null, `baby-photos/${filename}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      userId: req.user._id.toString(),
      babyId: req.params.id || '',
      uploadDate: new Date().toISOString()
    });
  }
});

/**
 * S3 Storage for Audio Recordings
 */
const audioStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    const userId = req.user._id;
    const filename = generateSecureFilename(file.originalname, 'audio', userId);
    cb(null, `audio-recordings/${filename}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      userId: req.user._id.toString(),
      uploadDate: new Date().toISOString()
    });
  }
});

/**
 * S3 Storage for User Avatars
 */
const avatarStorage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  key: function (req, file, cb) {
    const userId = req.user._id;
    const filename = generateSecureFilename(file.originalname, 'avatar', userId);
    cb(null, `avatars/${filename}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      userId: req.user._id.toString(),
      uploadDate: new Date().toISOString()
    });
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
 * File filter for audio
 */
const audioFileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/flac'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid audio type. Only WAV, MP3, M4A, and FLAC files are allowed.'), false);
  }
};

/**
 * Multer configurations
 */
const photoUpload = multer({
  storage: babyPhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

/**
 * Utility functions
 */
const createBucketIfNotExists = async () => {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`✅ Bucket ${BUCKET_NAME} exists`);
  } catch (error) {
    if (error.statusCode === 404) {
      try {
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
  uploadBabyPhoto: photoUpload.single('photo'),
  uploadAudioRecording: audioUpload.single('audio'),
  uploadAvatar: avatarUpload.single('avatar')
}; 