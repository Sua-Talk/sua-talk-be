/**
 * Audio Streaming Example for SuaTalk API
 * 
 * This example shows how to use the new /api/audio/stream/{id} endpoint
 * to play audio files with proper CORS handling.
 */

class AudioStreamer {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }

  /**
   * Method 1: Create HTML Audio Element with streaming URL
   * This is the simplest approach for basic audio playback
   */
  createAudioPlayer(recordingId, containerId) {
    const container = document.getElementById(containerId);
    const streamUrl = `${this.apiBaseUrl}/api/audio/stream/${recordingId}`;

    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    audioElement.preload = 'metadata'; // Only load metadata initially
    audioElement.crossorigin = 'use-credentials'; // Important for CORS
    
    // Set the source with authorization header
    audioElement.src = streamUrl;
    
    // Add authorization header via request interceptor
    // Note: This might require additional setup depending on your setup
    audioElement.addEventListener('loadstart', () => {
      console.log('Audio loading started');
    });

    audioElement.addEventListener('error', (e) => {
      console.error('Audio loading error:', e);
      this.handleAudioError(e, recordingId);
    });

    container.appendChild(audioElement);
    return audioElement;
  }

  /**
   * Method 2: Use fetch with proper headers
   * This gives more control over the request and error handling
   */
  async createStreamWithFetch(recordingId) {
    try {
      const streamUrl = `${this.apiBaseUrl}/api/audio/stream/${recordingId}`;
      
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Accept': 'audio/*'
        },
        credentials: 'include' // Important for CORS with cookies
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the blob URL for the audio
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return audioUrl;
    } catch (error) {
      console.error('Error streaming audio:', error);
      throw error;
    }
  }

  /**
   * Method 3: Advanced player with range request support
   * This supports seeking and partial loading
   */
  async createAdvancedPlayer(recordingId, containerId) {
    const container = document.getElementById(containerId);
    const streamUrl = `${this.apiBaseUrl}/api/audio/stream/${recordingId}`;

    // Create custom audio player with range support
    const playerDiv = document.createElement('div');
    playerDiv.className = 'custom-audio-player';

    const audioElement = document.createElement('audio');
    audioElement.preload = 'none';
    audioElement.crossorigin = 'use-credentials';

    // Custom controls
    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.onclick = () => this.togglePlay(audioElement, playButton);

    const progressBar = document.createElement('input');
    progressBar.type = 'range';
    progressBar.min = '0';
    progressBar.max = '100';
    progressBar.value = '0';
    progressBar.onchange = () => this.seekAudio(audioElement, progressBar);

    const timeDisplay = document.createElement('span');
    timeDisplay.textContent = '00:00 / 00:00';

    // Add event listeners
    audioElement.addEventListener('loadedmetadata', () => {
      progressBar.max = audioElement.duration;
      this.updateTimeDisplay(audioElement, timeDisplay);
    });

    audioElement.addEventListener('timeupdate', () => {
      progressBar.value = audioElement.currentTime;
      this.updateTimeDisplay(audioElement, timeDisplay);
    });

    // Set source with custom headers (using a proxy if needed)
    audioElement.src = streamUrl;

    playerDiv.appendChild(playButton);
    playerDiv.appendChild(progressBar);
    playerDiv.appendChild(timeDisplay);
    playerDiv.appendChild(audioElement);

    container.appendChild(playerDiv);
    return { audioElement, playButton, progressBar, timeDisplay };
  }

  /**
   * Method 4: Handle streaming with axios for better error handling
   */
  async streamWithAxios(recordingId) {
    try {
      const axios = require('axios'); // Make sure axios is installed

      const response = await axios({
        method: 'get',
        url: `${this.apiBaseUrl}/api/audio/stream/${recordingId}`,
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        },
        responseType: 'blob',
        withCredentials: true
      });

      // Create blob URL
      const audioBlob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'audio/mpeg' 
      });
      
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Axios streaming error:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  // Helper methods
  togglePlay(audioElement, button) {
    if (audioElement.paused) {
      audioElement.play();
      button.textContent = 'Pause';
    } else {
      audioElement.pause();
      button.textContent = 'Play';
    }
  }

  seekAudio(audioElement, progressBar) {
    audioElement.currentTime = progressBar.value;
  }

  updateTimeDisplay(audioElement, timeDisplay) {
    const current = this.formatTime(audioElement.currentTime);
    const duration = this.formatTime(audioElement.duration);
    timeDisplay.textContent = `${current} / ${duration}`;
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  handleAudioError(error, recordingId) {
    console.error(`Audio error for recording ${recordingId}:`, error);
    
    // Common error handling
    switch (error.target.error.code) {
      case error.target.error.MEDIA_ERR_ABORTED:
        console.error('Audio playback aborted');
        break;
      case error.target.error.MEDIA_ERR_NETWORK:
        console.error('Network error while loading audio');
        break;
      case error.target.error.MEDIA_ERR_DECODE:
        console.error('Audio decoding error');
        break;
      case error.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        console.error('Audio format not supported');
        break;
      default:
        console.error('Unknown audio error');
        break;
    }
  }
}

// Usage Examples:

// Example 1: Basic usage
const streamer = new AudioStreamer('https://api.suatalk.site', 'your-jwt-token');

// Create a simple audio player
// streamer.createAudioPlayer('507f1f77bcf86cd799439011', 'audio-container');

// Example 2: Using fetch
/*
streamer.createStreamWithFetch('507f1f77bcf86cd799439011')
  .then(audioUrl => {
    const audio = new Audio(audioUrl);
    audio.controls = true;
    document.body.appendChild(audio);
  })
  .catch(error => console.error('Streaming failed:', error));
*/

// Example 3: Advanced player
// streamer.createAdvancedPlayer('507f1f77bcf86cd799439011', 'advanced-player-container');

// Example 4: React component example
/*
const AudioPlayer = ({ recordingId, authToken }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const streamer = new AudioStreamer('https://api.suatalk.site', authToken);
    
    streamer.createStreamWithFetch(recordingId)
      .then(url => {
        setAudioUrl(url);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [recordingId, authToken]);

  if (loading) return <div>Loading audio...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <audio 
      controls 
      src={audioUrl}
      onError={(e) => setError('Audio playback failed')}
    >
      Your browser does not support the audio element.
    </audio>
  );
};
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioStreamer;
} 