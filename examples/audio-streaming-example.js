/**
 * Audio Streaming Example for Frontend
 * Shows how to properly stream audio from SuaTalk API
 */

class SuaTalkAudioPlayer {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.currentAudio = null;
  }

  /**
   * Method 1: Using /audio/stream-url (RECOMMENDED for web apps)
   * Gets streaming URL first, then plays audio
   */
  async playAudioViaStreamUrl(recordingId) {
    try {
      console.log('🎵 Getting stream URL for recording:', recordingId);
      
      // Step 1: Get streaming URL
      const response = await fetch(`${this.apiBaseUrl}/audio/stream-url/${recordingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to get stream URL');
      }

      console.log('✅ Stream URL received:', data.data.streamUrl);
      
      // Step 2: Play audio using the URL
      this.currentAudio = new Audio(data.data.streamUrl);
      
      // Set audio metadata
      this.currentAudio.preload = 'metadata';
      
      // Add event listeners
      this.currentAudio.addEventListener('loadedmetadata', () => {
        console.log(`🎵 Audio loaded - Duration: ${this.currentAudio.duration}s`);
      });
      
      this.currentAudio.addEventListener('canplay', () => {
        console.log('✅ Audio ready to play');
        this.currentAudio.play();
      });
      
      this.currentAudio.addEventListener('error', (e) => {
        console.error('❌ Audio playback error:', e);
      });

      return {
        audio: this.currentAudio,
        metadata: data.data,
        success: true
      };

    } catch (error) {
      console.error('❌ Error playing audio via stream URL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Method 2: Using /audio/stream directly (for development/local)
   * Only works in development or when API returns binary directly
   */
  async playAudioDirectStream(recordingId) {
    try {
      console.log('🎵 Direct streaming audio for recording:', recordingId);
      
      // Check if this returns JSON (production) or binary (development)
      const response = await fetch(`${this.apiBaseUrl}/audio/stream/${recordingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Range': 'bytes=0-1023' // Request first 1KB to test
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // Production mode - got JSON with signed URL
        const data = await response.json();
        console.log('🔄 Got JSON response, using stream URL method');
        
        this.currentAudio = new Audio(data.data.streamUrl);
        this.currentAudio.play();
        
        return {
          audio: this.currentAudio,
          metadata: data.data,
          success: true,
          note: 'Switched to stream URL method'
        };
      } else {
        // Development mode - got binary audio
        console.log('🎵 Got binary audio, creating blob URL');
        
        // For range requests, need to get full file
        const fullResponse = await fetch(`${this.apiBaseUrl}/audio/stream/${recordingId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
        
        const audioBlob = await fullResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.play();
        
        // Cleanup blob URL when done
        this.currentAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        });
        
        return {
          audio: this.currentAudio,
          success: true,
          note: 'Used direct binary streaming'
        };
      }

    } catch (error) {
      console.error('❌ Error with direct streaming:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Method 3: Smart audio player (tries best method automatically)
   */
  async playAudio(recordingId) {
    console.log('🎵 Smart audio player starting for recording:', recordingId);
    
    // Try stream-url method first (recommended)
    let result = await this.playAudioViaStreamUrl(recordingId);
    
    if (!result.success) {
      console.log('🔄 Stream URL method failed, trying direct stream...');
      result = await this.playAudioDirectStream(recordingId);
    }
    
    return result;
  }

  /**
   * Stop current audio playback
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      console.log('⏹️ Audio stopped');
    }
  }

  /**
   * Pause current audio
   */
  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      console.log('⏸️ Audio paused');
    }
  }

  /**
   * Resume current audio
   */
  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
      console.log('▶️ Audio resumed');
    }
  }
}

// Usage Examples:

// Example 1: Basic usage
async function basicExample() {
  const player = new SuaTalkAudioPlayer('https://api.suatalk.site', 'your-jwt-token');
  const result = await player.playAudio('6850e62ba2440c3e8076859e');
  
  if (result.success) {
    console.log('🎵 Audio is playing!');
    
    // Control playback
    setTimeout(() => player.pause(), 5000);   // Pause after 5 seconds
    setTimeout(() => player.resume(), 8000);  // Resume after 8 seconds
    setTimeout(() => player.stop(), 15000);   // Stop after 15 seconds
  } else {
    console.error('❌ Failed to play audio:', result.error);
  }
}

// Example 2: With HTML audio element
async function htmlAudioExample() {
  const audioElement = document.getElementById('audio-player');
  const recordingId = '6850e62ba2440c3e8076859e';
  
  try {
    // Get stream URL
    const response = await fetch(`https://api.suatalk.site/audio/stream-url/${recordingId}`, {
      headers: {
        'Authorization': 'Bearer your-jwt-token'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Set audio source
      audioElement.src = data.data.streamUrl;
      audioElement.load();
      
      // Add metadata
      audioElement.title = data.data.filename;
      
      // Play when ready
      audioElement.addEventListener('canplay', () => {
        audioElement.play();
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 3: React Component
const AudioPlayer = ({ recordingId, authToken }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const audioRef = React.useRef(null);

  const playAudio = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://api.suatalk.site/audio/stream-url/${recordingId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        if (audioRef.current) {
          audioRef.current.src = data.data.streamUrl;
          audioRef.current.load();
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div>
      <audio 
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => setError('Audio playback failed')}
      />
      
      <button 
        onClick={isPlaying ? stopAudio : playAudio}
        disabled={loading}
      >
        {loading ? 'Loading...' : isPlaying ? 'Stop' : 'Play'}
      </button>
      
      {error && <div style={{color: 'red'}}>Error: {error}</div>}
    </div>
  );
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SuaTalkAudioPlayer };
}

// Make available in browser
if (typeof window !== 'undefined') {
  window.SuaTalkAudioPlayer = SuaTalkAudioPlayer;
}

// Audio Streaming Best Practices Example
// Handles duration 0 issue with multiple fallback strategies

class AudioPlayer {
  constructor(audioElement) {
    this.audio = audioElement;
    this.expectedDuration = null;
    this.fallbackStrategies = ['metadata', 'progressive', 'download'];
    this.currentStrategy = 0;
  }

  async playAudio(streamUrl, expectedDuration = null) {
    this.expectedDuration = expectedDuration;
    
    // Strategy 1: Use X-Content-Duration header
    try {
      await this.loadWithMetadata(streamUrl);
      if (this.audio.duration > 0) {
        console.log('✅ Duration loaded from metadata:', this.audio.duration);
        return;
      }
    } catch (error) {
      console.warn('⚠️ Metadata strategy failed:', error);
    }

    // Strategy 2: Progressive loading with timeout
    try {
      await this.loadWithProgressiveTimeout(streamUrl);
      if (this.audio.duration > 0) {
        console.log('✅ Duration loaded progressively:', this.audio.duration);
        return;
      }
    } catch (error) {
      console.warn('⚠️ Progressive strategy failed:', error);
    }

    // Strategy 3: Force download then play
    try {
      await this.loadWithDownload(streamUrl);
      console.log('✅ Duration loaded via download:', this.audio.duration);
    } catch (error) {
      console.error('❌ All strategies failed:', error);
      // Use expected duration as fallback
      if (this.expectedDuration) {
        this.setFallbackDuration(this.expectedDuration);
      }
    }
  }

  async loadWithMetadata(streamUrl) {
    return new Promise((resolve, reject) => {
      this.audio.src = streamUrl;
      this.audio.preload = 'metadata';
      
      const timeout = setTimeout(() => {
        reject(new Error('Metadata timeout'));
      }, 3000);

      this.audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      this.audio.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Audio load error'));
      }, { once: true });

      this.audio.load();
    });
  }

  async loadWithProgressiveTimeout(streamUrl) {
    return new Promise((resolve, reject) => {
      this.audio.src = streamUrl;
      this.audio.preload = 'auto';
      
      let progressTimeout;
      let lastProgress = 0;
      
      const checkProgress = () => {
        if (this.audio.buffered.length > 0) {
          const currentProgress = this.audio.buffered.end(0);
          if (currentProgress > lastProgress) {
            lastProgress = currentProgress;
            
            // Check if we have enough data and duration
            if (this.audio.duration > 0) {
              clearTimeout(progressTimeout);
              resolve();
              return;
            }
          }
        }
        
        // Continue checking
        progressTimeout = setTimeout(checkProgress, 500);
      };

      // Start progress checking
      checkProgress();
      
      // Overall timeout
      setTimeout(() => {
        clearTimeout(progressTimeout);
        reject(new Error('Progressive timeout'));
      }, 10000);

      this.audio.addEventListener('error', () => {
        clearTimeout(progressTimeout);
        reject(new Error('Progressive load error'));
      }, { once: true });

      this.audio.load();
    });
  }

  async loadWithDownload(streamUrl) {
    return new Promise((resolve, reject) => {
      // Force full download
      this.audio.src = streamUrl;
      this.audio.preload = 'auto';
      
      const timeout = setTimeout(() => {
        reject(new Error('Download timeout'));
      }, 30000);

      this.audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      this.audio.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Download error'));
      }, { once: true });

      this.audio.load();
    });
  }

  setFallbackDuration(duration) {
    console.log(`🔄 Using fallback duration: ${duration}s`);
    
    // Create a visual indicator of duration
    const durationDisplay = document.querySelector('.audio-duration');
    if (durationDisplay) {
      durationDisplay.textContent = this.formatTime(duration);
    }
    
    // Store expected duration for progress calculation
    this.audio.dataset.expectedDuration = duration;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Usage Example
async function initializeAudioPlayer() {
  const audioElement = document.getElementById('audioPlayer');
  const player = new AudioPlayer(audioElement);
  
  // Get stream URL from API
  const response = await fetch('/audio/stream-url/RECORDING_ID', {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Use proxy URL for better compatibility
    const proxyUrl = `/audio/proxy/${data.data.recordingId}`;
    
    // Play with expected duration fallback
    await player.playAudio(proxyUrl, data.data.duration);
  }
}

// Alternative: Simple duration fix with retry
function simpleAudioFix(audioElement, streamUrl, expectedDuration) {
  audioElement.src = streamUrl;
  
  // Add X-Content-Duration header check
  fetch(streamUrl, { method: 'HEAD' })
    .then(response => {
      const serverDuration = response.headers.get('X-Content-Duration');
      if (serverDuration && serverDuration !== '0') {
        console.log('✅ Server provided duration:', serverDuration);
      }
    });
  
  // Retry mechanism for duration
  let retryCount = 0;
  const maxRetries = 3;
  
  const checkDuration = () => {
    if (audioElement.duration && audioElement.duration > 0) {
      console.log('✅ Duration loaded:', audioElement.duration);
      return;
    }
    
    retryCount++;
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying duration check (${retryCount}/${maxRetries})`);
      setTimeout(checkDuration, 1000);
    } else {
      console.log(`🔄 Using fallback duration: ${expectedDuration}s`);
      // Show expected duration in UI
      updateDurationDisplay(expectedDuration);
    }
  };
  
  audioElement.addEventListener('loadedmetadata', checkDuration);
  audioElement.load();
}

function updateDurationDisplay(duration) {
  const display = document.querySelector('.duration-display');
  if (display) {
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    display.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioPlayer, simpleAudioFix };
} 