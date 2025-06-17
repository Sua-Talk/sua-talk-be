const ffprobe = require('node-ffprobe');
const { parseFile } = require('music-metadata');
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
      
      console.log('🔍 Starting metadata extraction for:', originalName || audioFilePath);
      
      // Handle different input types
      if (typeof audioFilePath === 'string') {
        // File path input
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        
        console.log('📂 Processing file from path:', audioFilePath);
        
        // Try music-metadata FIRST (more reliable for deployment)
        try {
          console.log('🎵 Trying music-metadata as primary method...');
          const musicMetadata = await this.extractMetadataWithMusicMetadata(audioFilePath, originalName);
          if (musicMetadata && musicMetadata.isValid) {
            console.log('✅ Successfully extracted metadata using music-metadata (primary)');
            return musicMetadata;
          }
        } catch (musicError) {
          console.warn('⚠️ Music-metadata failed, trying FFprobe as fallback:', musicError.message);
        }
        
        // FFprobe as fallback (only if music-metadata fails)
        try {
          console.log('🔧 Trying FFprobe as fallback...');
          metadata = await this.executeFFProbeWithTimeout(audioFilePath, 10000); // 10 second timeout
        } catch (ffprobeError) {
          console.error('❌ FFProbe execution also failed:', {
            error: ffprobeError.message,
            path: audioFilePath,
            exists: fs.existsSync(audioFilePath)
          });
          
          // Both methods failed, throw error to trigger final fallback
          throw new Error(`Both music-metadata and FFProbe failed: ${ffprobeError.message}`);
        }
        
      } else if (Buffer.isBuffer(audioFilePath)) {
        // Buffer input - write to temp file for ffprobe
        tempFilePath = path.join(__dirname, '../../uploads/temp', `temp_${Date.now()}_${originalName || 'audio.tmp'}`);
        
        console.log('📦 Processing buffer, creating temp file:', tempFilePath);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, audioFilePath);
        
        // Verify temp file was created successfully
        if (!fs.existsSync(tempFilePath)) {
          throw new Error('Failed to create temporary file for buffer processing');
        }
        
        try {
          metadata = await this.executeFFProbeWithTimeout(tempFilePath, 10000);
        } catch (ffprobeError) {
          console.error('❌ FFProbe execution failed on temp file:', {
            error: ffprobeError.message,
            tempPath: tempFilePath,
            exists: fs.existsSync(tempFilePath)
          });
          throw ffprobeError;
        }
        
      } else {
        throw new Error('Invalid input: audioFilePath must be a string path or Buffer');
      }

      // Validate metadata structure
      if (!metadata || typeof metadata !== 'object') {
        throw new Error('FFProbe returned invalid metadata structure');
      }

      if (!metadata.streams || !Array.isArray(metadata.streams)) {
        throw new Error('FFProbe returned metadata without streams array');
      }

      // Extract audio stream information
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('No audio stream found in the file');
      }

      // Parse duration with multiple fallbacks
      let duration = 0;
      if (audioStream.duration && !isNaN(parseFloat(audioStream.duration))) {
        duration = parseFloat(audioStream.duration);
      } else if (metadata.format && metadata.format.duration && !isNaN(parseFloat(metadata.format.duration))) {
        duration = parseFloat(metadata.format.duration);
      } else {
        console.warn('⚠️ No valid duration found in metadata, using 0');
      }
      
      // Validate duration (max 5 minutes = 300 seconds)
      if (duration > 300) {
        throw new Error(`Audio duration (${duration.toFixed(1)}s) exceeds maximum allowed duration of 5 minutes (300s)`);
      }

      // Extract comprehensive metadata with safe parsing
      const extractedMetadata = {
        // Basic info
        duration: Math.round(duration * 10) / 10, // Round to 1 decimal place
        fileSize: this.safeParseInt(metadata.format?.size),
        
        // Audio properties
        sampleRate: this.safeParseInt(audioStream.sample_rate),
        channels: audioStream.channels || null,
        channelLayout: audioStream.channel_layout || null,
        bitRate: this.safeParseInt(audioStream.bit_rate) || this.safeParseInt(metadata.format?.bit_rate),
        
        // Format info
        codec: audioStream.codec_name || null,
        format: metadata.format?.format_name || null,
        container: metadata.format?.format_long_name || null,
        
        // Additional metadata
        title: metadata.format?.tags?.title || null,
        artist: metadata.format?.tags?.artist || null,
        album: metadata.format?.tags?.album || null,
        
        // Technical details
        startTime: this.safeParseFloat(audioStream.start_time) || 0,
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
          console.log('🗑️ Cleaned up temp file:', tempFilePath);
        } catch (cleanupError) {
          console.warn('⚠️ Could not cleanup temp file:', tempFilePath, cleanupError.message);
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
      // Cleanup temp file on error (only if it was defined in this scope)
      if (typeof tempFilePath !== 'undefined' && tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('🗑️ Cleaned up temp file after error:', tempFilePath);
        } catch (cleanupError) {
          console.warn('⚠️ Could not cleanup temp file on error:', tempFilePath, cleanupError.message);
        }
      }

      console.error('❌ Audio metadata extraction failed:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        originalName: originalName
      });
      
      // Both primary methods failed, but this is normal if FFmpeg isn't installed
      console.log('ℹ️ Both metadata extraction methods failed - this is normal in environments without FFmpeg');
      console.log('💡 Using graceful degradation with basic file information');
      
      // Return fallback metadata for graceful degradation
      return this.getFallbackMetadata(originalName, error);
    }
  }

  /**
   * Execute ffprobe with timeout and better error handling
   * @param {string} filePath - Path to audio file
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Object>} FFProbe metadata
   */
  async executeFFProbeWithTimeout(filePath, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      // Set up timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`FFProbe timeout after ${timeoutMs}ms for file: ${filePath}`));
        }
      }, timeoutMs);
      
      // Execute ffprobe
      ffprobe(filePath)
        .then(result => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            
            // Additional validation of ffprobe result
            if (!result) {
              reject(new Error('FFProbe returned null/undefined result'));
            } else if (typeof result !== 'object') {
              reject(new Error(`FFProbe returned non-object result: ${typeof result}`));
            } else {
              resolve(result);
            }
          }
        })
        .catch(error => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            
            // Enhance error message with more context
            const enhancedError = new Error(`FFProbe execution failed: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.filePath = filePath;
            
            reject(enhancedError);
          }
        });
    });
  }

  /**
   * Safely parse integer from string/number
   * @param {*} value - Value to parse
   * @returns {number|null} Parsed integer or null
   */
  safeParseInt(value) {
    if (value === null || value === undefined) return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Safely parse float from string/number
   * @param {*} value - Value to parse
   * @returns {number|null} Parsed float or null
   */
  safeParseFloat(value) {
    if (value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Get fallback metadata when extraction fails
   * @param {string} originalName - Original filename
   * @param {Error} error - The extraction error
   * @returns {Object} Fallback metadata
   */
  getFallbackMetadata(originalName, error) {
    console.warn('🔄 Using fallback metadata extraction due to error:', error.message);
    
    // Check if it's an FFprobe not found error or JSON parsing error
    if (error.message && (error.message.includes('spawn ffprobe ENOENT') || error.message.includes('JSON'))) {
      if (error.message.includes('spawn ffprobe ENOENT')) {
        console.error('❌ FFprobe binary not found! Please install FFmpeg.');
        console.log('💡 Installation instructions:');
        console.log('   Windows: Download from https://ffmpeg.org/download.html');
        console.log('   Or use chocolatey: choco install ffmpeg');
        console.log('   Or use winget: winget install Gyan.FFmpeg');
        console.log('   Make sure ffprobe.exe is in your system PATH');
      } else {
        console.error('❌ FFprobe JSON parsing error - this can happen with corrupted output.');
        console.log('💡 Using music-metadata fallback for better compatibility.');
      }
    }
    
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
      
      // Error info
      notice: `Metadata extraction failed: ${error.message}`,
      extractionError: error.message.includes('spawn ffprobe ENOENT') ? 'FFPROBE_NOT_FOUND' : 'EXTRACTION_FAILED',
      
      // Processing info
      extractedAt: new Date().toISOString(),
      extractionMethod: 'fallback'
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

  /**
   * Extract metadata using music-metadata library (fallback)
   * @param {string|Buffer} audioFilePath - Path to audio file or buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<Object>} Audio metadata
   */
  async extractMetadataWithMusicMetadata(audioFilePath, originalName = null) {
    try {
      let metadata;
      let tempFilePath = null;
      
      console.log('🎵 Using music-metadata for:', originalName || audioFilePath);
      
      // Handle different input types
      if (typeof audioFilePath === 'string') {
        // File path input
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        metadata = await parseFile(audioFilePath);
      } else if (Buffer.isBuffer(audioFilePath)) {
        // Buffer input - write to temp file
        tempFilePath = path.join(__dirname, '../../uploads/temp', `temp_mm_${Date.now()}_${originalName || 'audio.tmp'}`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, audioFilePath);
        metadata = await parseFile(tempFilePath);
      } else {
        throw new Error('Invalid input: audioFilePath must be a string path or Buffer');
      }

      // Extract duration
      const duration = metadata.format.duration || 0;
      
      // Validate duration (max 5 minutes = 300 seconds)
      if (duration > 300) {
        throw new Error(`Audio duration (${duration.toFixed(1)}s) exceeds maximum allowed duration of 5 minutes (300s)`);
      }

      // Extract comprehensive metadata
      const extractedMetadata = {
        // Basic info
        duration: Math.round(duration * 10) / 10,
        fileSize: metadata.format.size || null,
        
        // Audio properties
        sampleRate: metadata.format.sampleRate || null,
        channels: metadata.format.numberOfChannels || null,
        channelLayout: null, // Not available in music-metadata
        bitRate: metadata.format.bitrate || null,
        
        // Format info
        codec: metadata.format.codec || metadata.format.codecProfile || null,
        format: metadata.format.container || null,
        container: metadata.format.container || null,
        
        // Additional metadata
        title: metadata.common.title || null,
        artist: metadata.common.artist || null,
        album: metadata.common.album || null,
        
        // Technical details
        startTime: 0, // Not available in music-metadata
        timeBase: null, // Not available in music-metadata
        
        // Validation flags
        isValid: true,
        hasAudioStream: true,
        
        // Processing info
        extractedAt: new Date().toISOString(),
        extractionMethod: 'music-metadata'
      };

      // Cleanup temp file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('🗑️ Cleaned up temp file:', tempFilePath);
        } catch (cleanupError) {
          console.warn('⚠️ Could not cleanup temp file:', tempFilePath, cleanupError.message);
        }
      }

      console.log('✅ Music-metadata extraction successful:', {
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
          console.log('🗑️ Cleaned up temp file after error:', tempFilePath);
        } catch (cleanupError) {
          console.warn('⚠️ Could not cleanup temp file on error:', tempFilePath, cleanupError.message);
        }
      }

      console.error('❌ Music-metadata extraction failed:', {
        error: error.message,
        originalName: originalName
      });
      
      throw error; // Re-throw to be handled by caller
    }
  }
}

module.exports = new AudioMetadataService(); 