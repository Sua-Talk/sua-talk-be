const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Process avatar image - resize and optimize
 * @param {string} inputPath - Path to uploaded image
 * @param {string} userId - User ID for filename
 * @returns {Promise<Object>} - Processed image info
 */
const processAvatar = async (inputPath, userId) => {
  try {
    const timestamp = Date.now();
    const outputFilename = `avatar-${userId}-${timestamp}-processed.webp`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    // Process image with Sharp
    const processedImage = await sharp(inputPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .webp({
        quality: 85,
        effort: 4
      })
      .toFile(outputPath);

    // Get image metadata
    const metadata = await sharp(outputPath).metadata();

    // Delete original file after processing
    try {
      await fs.unlink(inputPath);
    } catch (unlinkError) {
      console.warn('Warning: Could not delete original file:', unlinkError);
    }

    return {
      filename: outputFilename,
      path: outputPath,
      size: processedImage.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      url: `/uploads/avatars/${outputFilename}`
    };

  } catch (error) {
    // Clean up original file on error
    try {
      await fs.unlink(inputPath);
    } catch (unlinkError) {
      console.warn('Warning: Could not delete original file on error:', unlinkError);
    }
    
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

/**
 * Delete avatar image file
 * @param {string} filename - Filename to delete
 * @returns {Promise<boolean>} - Success status
 */
const deleteAvatar = async (filename) => {
  try {
    if (!filename) return true;
    
    const avatarsDir = path.join(__dirname, '../../uploads/avatars');
    const filePath = path.join(avatarsDir, filename);
    
    // Check if file exists before trying to delete
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      // File doesn't exist or can't be deleted
      console.warn('Warning: Could not delete avatar file:', error);
      return false;
    }
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return false;
  }
};

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} - Validation result
 */
const validateImageFile = async (filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    
    // Check if it's a valid image
    if (!metadata.format) {
      throw new Error('Invalid image file');
    }
    
    // Check image dimensions
    if (metadata.width < 50 || metadata.height < 50) {
      throw new Error('Image too small. Minimum size is 50x50 pixels');
    }
    
    if (metadata.width > 5000 || metadata.height > 5000) {
      throw new Error('Image too large. Maximum size is 5000x5000 pixels');
    }
    
    return {
      valid: true,
      metadata
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
};

module.exports = {
  processAvatar,
  deleteAvatar,
  validateImageFile
}; 