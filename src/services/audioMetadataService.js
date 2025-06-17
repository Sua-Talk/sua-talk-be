const ffprobe = require('node-ffprobe');
const path = require('path');
const fs = require('fs');

/**
 * Service for extracting audio metadata automatically
 * Compatible with Node.js v18+ using node-ffprobe
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
      let tempFilePath = null;
      
      // Handle different input types
      if (typeof audioFilePath === 'string') {
        // File path input
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        metadata = await ffprobe(audioFilePath);
      } else if (Buffer.isBuffer(audioFilePath)) {
        // Buffer input - write to temp file for ffprobe
        tempFilePath = path.join(__dirname, '../../uploads/temp', `temp_${Date.now()}_${originalName || 'audio.tmp'}`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, audioFilePath);
        metadata = await ffprobe(tempFilePath);
      } else {
        throw new Error('Invalid input: audioFilePath must be a string path or Buffer');
      }

      // Extract audio stream information
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('No audio stream found in the file');
      }

      // Parse duration
      const duration = parseFloat(audioStream.duration || metadata.format.duration || 0);
      
      // Validate duration (max 5 minutes = 300 seconds)
      if (duration > 300) {
        throw new Error(`Audio duration (${duration.toFixed(1)}s) exceeds maximum allowed duration of 5 minutes (300s)`);
      }

      // Extract comprehensive metadata
      const extractedMetadata = {
        // Basic info
        duration: Math.round(duration * 10) / 10, // Round to 1 decimal place
        fileSize: metadata.format.size ? parseInt(metadata.format.size) : null,
        
        // Audio properties
        sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
        channels: audioStream.channels || null,
        channelLayout: audioStream.channel_layout || null,
        bitRate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : 
                 metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : null,
        
        // Format info
        codec: audioStream.codec_name || null,
        format: metadata.format.format_name || null,
        container: metadata.format.format_long_name || null,
        
        // Additional metadata
        title: metadata.format.tags?.title || null,
        artist: metadata.format.tags?.artist || null,
        album: metadata.format.tags?.album || null,
        
        // Technical details
        startTime: audioStream.start_time ? parseFloat(audioStream.start_time) : 0,
        timeBase: audioStream.time_base || null,
        
        // Validation flags
        isValid: true,
        hasAudioStream: true,
        
        // Processing info
        extractedAt: new Date().toISOString(),
        extractionMethod: 'ffprobe'
      };

      // Cleanup temp file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn('Warning: Could not cleanup temp file:', tempFilePath);
        }
      }

      console.log('✅ Audio metadata extracted successfully:', {
        duration: extractedMetadata.duration,
        sampleRate: extractedMetadata.sampleRate,
        channels: extractedMetadata.channels,
        codec: extractedMetadata.codec,
        format: extractedMetadata.format
      });

      return extractedMetadata;

    } catch (error) {
      // Cleanup temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn('Warning: Could not cleanup temp file on error:', tempFilePath);
        }
      }

      console.error('❌ Audio metadata extraction failed:', error.message);
      
      // Return fallback metadata for graceful degradation
      return this.getFallbackMetadata(originalName, error);
    }
  }

  /**
   * Get fallback metadata when extraction fails
   * @param {string} originalName - Original filename
   * @param {Error} error - The extraction error
   * @returns {Object} Fallback metadata
   */
  getFallbackMetadata(originalName, error) {
    console.warn('🔄 Using fallback metadata extraction');
    
    // Try to guess format from file extension
    const extension = originalName ? path.extname(originalName).toLowerCase() : '';
    let format = 'unknown';
    let codec = 'unknown';
    
    switch (extension) {
      case '.mp3':
        format = 'mp3';
        codec = 'mp3';
        break;
      case '.wav':
        format = 'wav';
        codec = 'pcm';
        break;
      case '.m4a':
        format = 'm4a';
        codec = 'aac';
        break;
      case '.ogg':
        format = 'ogg';
        codec = 'vorbis';
        break;
      case '.flac':
        format = 'flac';
        codec = 'flac';
        break;
      case '.webm':
        format = 'webm';
        codec = 'opus';
        break;
    }

    return {
      // Basic info - will be null/unknown since we can't extract
      duration: null, // Will need to be handled by controller
      fileSize: null,
      
      // Audio properties - reasonable defaults
      sampleRate: null,
      channels: null,
      channelLayout: null,
      bitRate: null,
      
      // Format info from filename
      codec: codec,
      format: format,
      container: format,
      
      // Additional metadata
      title: null,
      artist: null,
      album: null,
      
      // Technical details
      startTime: 0,
      timeBase: null,
      
      // Validation flags
      isValid: false,
      hasAudioStream: true, // Assume true since file was accepted by filter
      
      // Processing info
      extractedAt: new Date().toISOString(),
      extractionMethod: 'fallback',
      extractionError: error.message,
      
      // Fallback notice
      notice: 'Metadata extraction failed. Using fallback values. Audio processing may still work normally.'
    };
  }

  /**
   * Validate audio file without full metadata extraction
   * @param {string} filePath - Path to audio file
   * @returns {Promise<boolean>} Whether file is valid audio
   */
  async validateAudioFile(filePath) {
    try {
      const metadata = await ffprobe(filePath);
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      return !!audioStream;
    } catch (error) {
      console.warn('Audio validation failed:', error.message);
      return false; // Assume invalid if we can't probe it
    }
  }

  /**
   * Get supported audio formats
   * @returns {Array} List of supported formats
   */
  getSupportedFormats() {
    return [
      { extension: '.mp3', mimetype: 'audio/mpeg', description: 'MP3 Audio' },
      { extension: '.wav', mimetype: 'audio/wav', description: 'WAV Audio' },
      { extension: '.m4a', mimetype: 'audio/m4a', description: 'M4A Audio' },
      { extension: '.aac', mimetype: 'audio/aac', description: 'AAC Audio' },
      { extension: '.ogg', mimetype: 'audio/ogg', description: 'OGG Audio' },
      { extension: '.flac', mimetype: 'audio/flac', description: 'FLAC Audio' },
      { extension: '.webm', mimetype: 'audio/webm', description: 'WebM Audio' }
    ];
  }
}

module.exports = new AudioMetadataService(); 