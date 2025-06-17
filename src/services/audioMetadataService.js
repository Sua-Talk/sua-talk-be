const mm = require('music-metadata');
const path = require('path');
const fs = require('fs');

/**
 * Service for extracting audio metadata automatically
 */
class AudioMetadataService {
  /**
   * Extract metadata from audio file
   * @param {string|Buffer} audioFilePath - Path to audio file or buffer
   * @param {string} originalName - Original filename (for buffer input)
   * @returns {Promise<Object>} Audio metadata
   */
  async extractMetadata(audioFilePath, originalName = null) {
    try {
      let metadata;
      
      // Handle different input types
      if (typeof audioFilePath === 'string') {
        // File path input
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        metadata = await mm.parseFile(audioFilePath);
      } else {
        // Buffer input (from multer memory storage)
        const filename = originalName || 'audio.wav';
        const mimeType = this.getMimeTypeFromExtension(path.extname(filename));
        metadata = await mm.parseBuffer(audioFilePath, mimeType);
      }

      // Extract relevant metadata
      const audioMetadata = {
        // Duration in seconds (this is what we need!)
        duration: metadata.format.duration || null,
        
        // Audio format information
        sampleRate: metadata.format.sampleRate || null,
        bitrate: metadata.format.bitrate || null,
        numberOfChannels: metadata.format.numberOfChannels || null,
        
        // Container and codec info
        container: metadata.format.container || null,
        codec: metadata.format.codec || null,
        
        // File format
        lossless: metadata.format.lossless || false,
        
        // Additional metadata
        trackInfo: metadata.common ? {
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
          album: metadata.common.album || null
        } : null
      };

      console.log('🎵 Extracted audio metadata:', audioMetadata);
      
      return {
        success: true,
        metadata: audioMetadata
      };

    } catch (error) {
      console.error('❌ Failed to extract audio metadata:', error);
      
      return {
        success: false,
        error: error.message,
        metadata: null
      };
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} extension - File extension (with or without dot)
   * @returns {string} MIME type
   */
  getMimeTypeFromExtension(extension) {
    const ext = extension.toLowerCase().replace('.', '');
    
    const mimeTypes = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm'
    };

    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Validate audio file duration
   * @param {number} duration - Duration in seconds
   * @param {number} maxDuration - Maximum allowed duration (default: 300 seconds = 5 minutes)
   * @returns {boolean} Is duration valid
   */
  validateDuration(duration, maxDuration = 300) {
    if (typeof duration !== 'number' || isNaN(duration)) {
      return false;
    }
    
    return duration >= 0.1 && duration <= maxDuration;
  }

  /**
   * Format duration for human reading
   * @param {number} duration - Duration in seconds
   * @returns {string} Formatted duration (e.g., "2:35")
   */
  formatDuration(duration) {
    if (!duration || isNaN(duration)) {
      return null;
    }
    
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

module.exports = new AudioMetadataService(); 