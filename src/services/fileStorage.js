const fs = require('fs').promises;
const path = require('path');
const FileType = require('file-type');
const crypto = require('crypto');

/**
 * File Storage Service
 * Handles file operations with security measures and organized directory structure
 */
class FileStorageService {
  constructor() {
    this.uploadsRoot = path.join(__dirname, '../../uploads');
    this.directories = {
      avatars: path.join(this.uploadsRoot, 'avatars'),
      babyPhotos: path.join(this.uploadsRoot, 'baby-photos'),
      audioRecordings: path.join(this.uploadsRoot, 'audio-recordings'),
      temp: path.join(this.uploadsRoot, 'temp')
    };
    
    // Initialize directories
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    try {
      for (const [type, dir] of Object.entries(this.directories)) {
        await fs.mkdir(dir, { recursive: true });
      }
    } catch (error) {
      console.error('Error initializing directories:', error);
    }
  }

  /**
   * Generate secure filename to avoid conflicts
   * @param {string} originalName - Original filename
   * @param {string} prefix - Filename prefix
   * @param {string} userId - User ID for uniqueness
   * @returns {string} - Unique filename
   */
  generateSecureFilename(originalName, prefix = 'file', userId = null) {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName).toLowerCase();
    
    const userPart = userId ? `-${userId}` : '';
    return `${prefix}${userPart}-${timestamp}-${randomHash}${extension}`;
  }

  /**
   * Validate file type using file-type package
   * @param {string} filePath - Path to file
   * @param {Array} allowedTypes - Array of allowed MIME types
   * @returns {Object} - Validation result
   */
  async validateFileType(filePath, allowedTypes = []) {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Get file type from content (more secure than relying on extension)
      const fileType = await FileType.fromFile(filePath);
      
      if (!fileType) {
        return {
          valid: false,
          error: 'Could not determine file type',
          detectedType: null
        };
      }

      // Check against allowed types if provided
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileType.mime)) {
        return {
          valid: false,
          error: `Invalid file type. Detected: ${fileType.mime}, Allowed: ${allowedTypes.join(', ')}`,
          detectedType: fileType.mime
        };
      }

      return {
        valid: true,
        detectedType: fileType.mime,
        extension: fileType.ext
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        detectedType: null
      };
    }
  }

  /**
   * Save file to specified directory with validation
   * @param {Buffer|string} fileData - File data or source path
   * @param {string} directory - Target directory type
   * @param {string} filename - Target filename
   * @param {Object} options - Additional options
   * @returns {Object} - Save result
   */
  async saveFile(fileData, directory, filename, options = {}) {
    try {
      const targetDir = this.directories[directory];
      if (!targetDir) {
        throw new Error(`Invalid directory type: ${directory}`);
      }

      const targetPath = path.join(targetDir, filename);

      // Prevent directory traversal attacks
      if (!targetPath.startsWith(targetDir)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      // If fileData is a source path, copy the file
      if (typeof fileData === 'string') {
        await fs.copyFile(fileData, targetPath);
      } else {
        // If fileData is Buffer, write directly
        await fs.writeFile(targetPath, fileData);
      }

      // Validate file type if specified
      if (options.allowedTypes) {
        const validation = await this.validateFileType(targetPath, options.allowedTypes);
        if (!validation.valid) {
          // Clean up invalid file
          await this.deleteFile(directory, filename);
          throw new Error(validation.error);
        }
      }

      // Get file stats
      const stats = await fs.stat(targetPath);

      return {
        success: true,
        path: targetPath,
        relativePath: path.join(directory, filename),
        size: stats.size,
        filename,
        directory
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve file information
   * @param {string} directory - Directory type
   * @param {string} filename - Filename
   * @returns {Object} - File information
   */
  async getFileInfo(directory, filename) {
    try {
      const targetDir = this.directories[directory];
      if (!targetDir) {
        throw new Error(`Invalid directory type: ${directory}`);
      }

      const filePath = path.join(targetDir, filename);

      // Prevent directory traversal attacks
      if (!filePath.startsWith(targetDir)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      const stats = await fs.stat(filePath);

      return {
        exists: true,
        path: filePath,
        relativePath: path.join(directory, filename),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        filename,
        directory
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          error: 'File not found'
        };
      }
      
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file from storage
   * @param {string} directory - Directory type
   * @param {string} filename - Filename to delete
   * @returns {Object} - Delete result
   */
  async deleteFile(directory, filename) {
    try {
      if (!filename) {
        return { success: true, message: 'No filename provided' };
      }

      const targetDir = this.directories[directory];
      if (!targetDir) {
        throw new Error(`Invalid directory type: ${directory}`);
      }

      const filePath = path.join(targetDir, filename);

      // Prevent directory traversal attacks
      if (!filePath.startsWith(targetDir)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      await fs.unlink(filePath);

      return {
        success: true,
        message: 'File deleted successfully',
        path: filePath
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: true,
          message: 'File already does not exist'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Move file from one location to another
   * @param {string} sourceDir - Source directory type
   * @param {string} targetDir - Target directory type
   * @param {string} sourceFilename - Source filename
   * @param {string} targetFilename - Target filename (optional)
   * @returns {Object} - Move result
   */
  async moveFile(sourceDir, targetDir, sourceFilename, targetFilename = null) {
    try {
      const sourceDirPath = this.directories[sourceDir];
      const targetDirPath = this.directories[targetDir];

      if (!sourceDirPath || !targetDirPath) {
        throw new Error('Invalid directory type');
      }

      const sourcePath = path.join(sourceDirPath, sourceFilename);
      const finalTargetFilename = targetFilename || sourceFilename;
      const targetPath = path.join(targetDirPath, finalTargetFilename);

      // Security checks
      if (!sourcePath.startsWith(sourceDirPath) || !targetPath.startsWith(targetDirPath)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      await fs.rename(sourcePath, targetPath);

      return {
        success: true,
        sourcePath,
        targetPath,
        filename: finalTargetFilename
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List files in a directory with pagination
   * @param {string} directory - Directory type
   * @param {Object} options - Options (limit, offset, filter)
   * @returns {Object} - List result
   */
  async listFiles(directory, options = {}) {
    try {
      const targetDir = this.directories[directory];
      if (!targetDir) {
        throw new Error(`Invalid directory type: ${directory}`);
      }

      const files = await fs.readdir(targetDir);
      
      // Apply filter if provided
      let filteredFiles = files;
      if (options.filter) {
        filteredFiles = files.filter(file => 
          file.toLowerCase().includes(options.filter.toLowerCase())
        );
      }

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginatedFiles = filteredFiles.slice(offset, offset + limit);

      // Get file stats for each file
      const fileDetails = await Promise.all(
        paginatedFiles.map(async (filename) => {
          const filePath = path.join(targetDir, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      );

      return {
        success: true,
        files: fileDetails,
        total: filteredFiles.length,
        limit,
        offset
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  /**
   * Clean up temporary files older than specified time
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {Object} - Cleanup result
   */
  async cleanupTempFiles(maxAgeHours = 24) {
    try {
      const tempDir = this.directories.temp;
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      
      const files = await fs.readdir(tempDir);
      let deletedCount = 0;
      const errors = [];

      for (const filename of files) {
        try {
          const filePath = path.join(tempDir, filename);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          errors.push({ filename, error: error.message });
        }
      }

      return {
        success: true,
        deletedCount,
        errors,
        message: `Cleaned up ${deletedCount} temporary files older than ${maxAgeHours} hours`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }

  /**
   * Download file from cloud storage (Minio) to local path
   * @param {string} objectKey - Object key in cloud storage
   * @param {string} localPath - Local file path to save to
   * @returns {Object} - Download result
   */
  async downloadFile(objectKey, localPath) {
    try {
      // Check if we're in production with cloud storage
      if (process.env.NODE_ENV !== 'production' || !process.env.MINIO_ENDPOINT) {
        throw new Error('Cloud storage not configured for this environment');
      }

      const AWS = require('aws-sdk');
      
      // Configure S3 client for Minio
      const s3Client = new AWS.S3({
        endpoint: process.env.MINIO_ENDPOINT,
        accessKeyId: process.env.MINIO_ACCESS_KEY,
        secretAccessKey: process.env.MINIO_SECRET_KEY,
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
        region: process.env.MINIO_REGION || 'us-east-1'
      });

      const bucketName = process.env.MINIO_BUCKET_NAME || 'suatalk-files';

      console.log(`📥 Downloading ${objectKey} from bucket ${bucketName} to ${localPath}`);

      // Get object from Minio
      const params = {
        Bucket: bucketName,
        Key: objectKey
      };

      const data = await s3Client.getObject(params).promise();
      
      // Write to local file
      const fs = require('fs').promises;
      await fs.writeFile(localPath, data.Body);

      console.log(`✅ Successfully downloaded ${objectKey} to ${localPath}`);

      return {
        success: true,
        localPath,
        objectKey,
        size: data.Body.length
      };

    } catch (error) {
      console.error(`❌ Failed to download file ${objectKey}:`, error);
      return {
        success: false,
        error: error.message,
        objectKey,
        localPath
      };
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} - Storage stats
   */
  async getStorageStats() {
    try {
      const stats = {};

      for (const [type, dir] of Object.entries(this.directories)) {
        try {
          const files = await fs.readdir(dir);
          let totalSize = 0;

          for (const filename of files) {
            const filePath = path.join(dir, filename);
            const fileStat = await fs.stat(filePath);
            totalSize += fileStat.size;
          }

          stats[type] = {
            fileCount: files.length,
            totalSize,
            totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
          };
        } catch (error) {
          stats[type] = {
            fileCount: 0,
            totalSize: 0,
            totalSizeMB: 0,
            error: error.message
          };
        }
      }

      return {
        success: true,
        stats
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const fileStorageService = new FileStorageService();

module.exports = fileStorageService; 