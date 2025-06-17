const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsync = util.promisify(exec);

class AudioProcessingService {
  /**
   * Process audio file to ensure valid headers and metadata
   * @param {string} inputPath - Path to input audio file
   * @param {string} outputPath - Path for processed output file
   * @returns {Promise<object>} Processing result with metadata
   */
  async processAudioFile(inputPath, outputPath) {
    try {
      console.log(`🔧 Processing audio file: ${inputPath}`);
      
      // FFmpeg command to fix WAV headers and ensure proper metadata
      const ffmpegCmd = [
        'ffmpeg',
        '-i', `"${inputPath}"`,
        '-acodec', 'pcm_s16le',  // Use uncompressed PCM
        '-ar', '44100',          // Standard sample rate
        '-ac', '2',              // Stereo
        '-avoid_negative_ts', 'make_zero',  // Fix timestamp issues
        '-fflags', '+bitexact',  // Ensure consistent output
        '-y',                    // Overwrite output
        `"${outputPath}"`
      ].join(' ');

      const { stdout, stderr } = await execAsync(ffmpegCmd);
      
      // Extract metadata using ffprobe
      const metadata = await this.extractMetadata(outputPath);
      
      console.log(`✅ Audio processed successfully: ${metadata.duration}s`);
      
      return {
        success: true,
        originalFile: inputPath,
        processedFile: outputPath,
        metadata: metadata
      };
      
    } catch (error) {
      console.error(`❌ Audio processing failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract audio metadata using ffprobe
   * @param {string} filePath - Path to audio file
   * @returns {Promise<object>} Audio metadata
   */
  async extractMetadata(filePath) {
    try {
      const ffprobeCmd = [
        'ffprobe',
        '-v', 'quiet',
        '-show_format',
        '-show_streams',
        '-of', 'json',
        `"${filePath}"`
      ].join(' ');

      const { stdout } = await execAsync(ffprobeCmd);
      const probeData = JSON.parse(stdout);
      
      const audioStream = probeData.streams.find(s => s.codec_type === 'audio');
      const format = probeData.format;
      
      return {
        duration: parseFloat(format.duration) || 0,
        bitRate: parseInt(format.bit_rate) || 0,
        sampleRate: parseInt(audioStream?.sample_rate) || 44100,
        channels: parseInt(audioStream?.channels) || 2,
        codec: audioStream?.codec_name || 'unknown',
        size: parseInt(format.size) || 0
      };
      
    } catch (error) {
      console.error(`❌ Metadata extraction failed:`, error);
      return {
        duration: 0,
        bitRate: 0,
        sampleRate: 44100,
        channels: 2,
        codec: 'unknown',
        size: 0
      };
    }
  }

  /**
   * Process uploaded audio file on-the-fly
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<object>} Processed audio buffer and metadata
   */
  async processAudioBuffer(audioBuffer, originalName) {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inputPath = path.join(tempDir, `input_${Date.now()}_${originalName}`);
    const outputPath = path.join(tempDir, `output_${Date.now()}_${originalName.replace(/\.[^/.]+$/, '.wav')}`);
    
    try {
      // Write buffer to temp file
      fs.writeFileSync(inputPath, audioBuffer);
      
      // Process audio
      const result = await this.processAudioFile(inputPath, outputPath);
      
      if (result.success) {
        // Read processed file
        const processedBuffer = fs.readFileSync(outputPath);
        
        // Cleanup temp files
        this.cleanupTempFiles([inputPath, outputPath]);
        
        return {
          success: true,
          buffer: processedBuffer,
          metadata: result.metadata
        };
      } else {
        // Cleanup temp files
        this.cleanupTempFiles([inputPath, outputPath]);
        return result;
      }
      
    } catch (error) {
      // Cleanup temp files
      this.cleanupTempFiles([inputPath, outputPath]);
      throw error;
    }
  }

  /**
   * Cleanup temporary files
   * @param {string[]} filePaths - Array of file paths to delete
   */
  cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup temp file: ${filePath}`, error);
      }
    });
  }

  /**
   * Check if FFmpeg is available
   * @returns {Promise<boolean>} True if FFmpeg is available
   */
  async checkFFmpegAvailability() {
    try {
      await execAsync('ffmpeg -version');
      await execAsync('ffprobe -version');
      return true;
    } catch (error) {
      console.error('❌ FFmpeg not available:', error.message);
      return false;
    }
  }
}

module.exports = new AudioProcessingService(); 