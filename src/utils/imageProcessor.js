const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Process uploaded baby photo
 * @param {string} inputPath - Path to the original uploaded file
 * @param {string} outputDir - Directory to save processed images
 * @param {string} filename - Base filename without extension
 * @returns {Object} - Object containing paths to processed images
 */
const processBabyPhoto = async (inputPath, outputDir, filename) => {
  try {
    const baseFilename = path.parse(filename).name;
    
    // Define output paths for different sizes
    const outputs = {
      thumbnail: path.join(outputDir, `${baseFilename}-thumb.webp`),
      medium: path.join(outputDir, `${baseFilename}-medium.webp`),
      original: path.join(outputDir, `${baseFilename}-original.webp`)
    };

    // Process image in different sizes
    const processPromises = [
      // Thumbnail: 150x150 (square crop)
      sharp(inputPath)
        .resize(150, 150, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 80 })
        .toFile(outputs.thumbnail),

      // Medium: 400x400 (square crop)
      sharp(inputPath)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toFile(outputs.medium),

      // Original: max 800x800 (maintain aspect ratio)
      sharp(inputPath)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 90 })
        .toFile(outputs.original)
    ];

    // Wait for all processing to complete
    await Promise.all(processPromises);

    // Delete the original uploaded file
    await fs.unlink(inputPath);

    // Return relative paths for database storage
    const relativePaths = {
      thumbnail: path.relative(path.join(__dirname, '../../'), outputs.thumbnail),
      medium: path.relative(path.join(__dirname, '../../'), outputs.medium),
      original: path.relative(path.join(__dirname, '../../'), outputs.original)
    };

    return {
      success: true,
      paths: relativePaths,
      sizes: {
        thumbnail: { width: 150, height: 150 },
        medium: { width: 400, height: 400 },
        original: { maxWidth: 800, maxHeight: 800 }
      }
    };

  } catch (error) {
    console.error('Image processing error:', error);
    
    // Try to clean up the original file if processing failed
    try {
      await fs.unlink(inputPath);
    } catch (unlinkError) {
      console.error('Failed to clean up original file:', unlinkError);
    }

    throw new Error(`Image processing failed: ${error.message}`);
  }
};

/**
 * Delete processed baby photo files
 * @param {Object} photoPaths - Object containing paths to photo files
 * @returns {Promise<void>}
 */
const deleteBabyPhoto = async (photoPaths) => {
  try {
    if (!photoPaths) return;

    const deletePromises = [];
    
    // Delete all photo variants if they exist
    if (photoPaths.thumbnail) {
      const thumbnailPath = path.join(__dirname, '../../', photoPaths.thumbnail);
      deletePromises.push(
        fs.unlink(thumbnailPath).catch(err => 
          console.warn('Failed to delete thumbnail:', err.message)
        )
      );
    }

    if (photoPaths.medium) {
      const mediumPath = path.join(__dirname, '../../', photoPaths.medium);
      deletePromises.push(
        fs.unlink(mediumPath).catch(err => 
          console.warn('Failed to delete medium photo:', err.message)
        )
      );
    }

    if (photoPaths.original) {
      const originalPath = path.join(__dirname, '../../', photoPaths.original);
      deletePromises.push(
        fs.unlink(originalPath).catch(err => 
          console.warn('Failed to delete original photo:', err.message)
        )
      );
    }

    await Promise.all(deletePromises);
    
  } catch (error) {
    console.error('Error deleting baby photo files:', error);
    // Don't throw error for cleanup operations
  }
};

/**
 * Validate image file
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} - Image metadata
 */
const validateImage = async (filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    
    // Check if it's a valid image
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    // Check minimum dimensions
    if (metadata.width < 100 || metadata.height < 100) {
      throw new Error('Image too small. Minimum size is 100x100 pixels');
    }

    // Check maximum dimensions
    if (metadata.width > 4000 || metadata.height > 4000) {
      throw new Error('Image too large. Maximum size is 4000x4000 pixels');
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    };

  } catch (error) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
};

module.exports = {
  processBabyPhoto,
  deleteBabyPhoto,
  validateImage
}; 