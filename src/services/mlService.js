const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

/**
 * Circuit Breaker States
 */
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service is back online
};

/**
 * ML Service Client with Circuit Breaker Pattern
 * Handles communication with the ML service for infant cry classification
 */
class MLService {
  constructor() {
    // Environment-based URL configuration
    this.baseURL = process.env.ML_SERVICE_URL;
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      state: CIRCUIT_STATES.CLOSED,
      failureCount: 0,
      failureThreshold: 5,         // Open circuit after 5 failures
      successThreshold: 2,         // Close circuit after 2 successes in half-open
      timeout: 60000,              // 1 minute timeout before trying half-open
      nextAttempt: Date.now(),
      successCount: 0
    };
    
    // Axios client configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds timeout for predictions
      headers: {
        'Accept': 'application/json',
      }
    });

    // Setup response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Record success for circuit breaker
        this.recordSuccess();
        return response;
      },
      (error) => {
        // Record failure for circuit breaker
        this.recordFailure();
        
        console.error('ML Service Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
          circuitState: this.circuitBreaker.state
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Record a successful request for circuit breaker
   */
  recordSuccess() {
    if (this.circuitBreaker.state === CIRCUIT_STATES.HALF_OPEN) {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.successCount >= this.circuitBreaker.successThreshold) {
        this.closeCircuit();
      }
    } else if (this.circuitBreaker.state === CIRCUIT_STATES.CLOSED) {
      // Reset failure count on successful request
      this.circuitBreaker.failureCount = 0;
    }
  }

  /**
   * Record a failed request for circuit breaker
   */
  recordFailure() {
    this.circuitBreaker.failureCount++;
    
    if (this.circuitBreaker.state === CIRCUIT_STATES.CLOSED && 
        this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.openCircuit();
    } else if (this.circuitBreaker.state === CIRCUIT_STATES.HALF_OPEN) {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit breaker
   */
  openCircuit() {
    this.circuitBreaker.state = CIRCUIT_STATES.OPEN;
    this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
    this.circuitBreaker.successCount = 0;
    console.warn(`ML Service circuit breaker OPENED. Next attempt at: ${new Date(this.circuitBreaker.nextAttempt)}`);
  }

  /**
   * Close the circuit breaker
   */
  closeCircuit() {
    this.circuitBreaker.state = CIRCUIT_STATES.CLOSED;
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.successCount = 0;
    console.info('ML Service circuit breaker CLOSED. Service restored.');
  }

  /**
   * Set circuit breaker to half-open state
   */
  halfOpenCircuit() {
    this.circuitBreaker.state = CIRCUIT_STATES.HALF_OPEN;
    this.circuitBreaker.successCount = 0;
    console.info('ML Service circuit breaker HALF-OPEN. Testing service...');
  }

  /**
   * Check if request should be allowed based on circuit breaker state
   */
  shouldAllowRequest() {
    switch (this.circuitBreaker.state) {
      case CIRCUIT_STATES.CLOSED:
        return true;
      
      case CIRCUIT_STATES.OPEN:
        if (Date.now() >= this.circuitBreaker.nextAttempt) {
          this.halfOpenCircuit();
          return true;
        }
        return false;
      
      case CIRCUIT_STATES.HALF_OPEN:
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Make a request with circuit breaker protection
   */
  async makeRequest(requestFn) {
    if (!this.shouldAllowRequest()) {
      const timeToNext = this.circuitBreaker.nextAttempt - Date.now();
      throw new Error(`Circuit breaker is OPEN. Service unavailable. Retry in ${Math.ceil(timeToNext / 1000)} seconds.`);
    }

    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreaker.state,
      failureCount: this.circuitBreaker.failureCount,
      successCount: this.circuitBreaker.successCount,
      nextAttempt: this.circuitBreaker.nextAttempt,
      timeToNextAttempt: Math.max(0, this.circuitBreaker.nextAttempt - Date.now())
    };
  }

  /**
   * Check ML service health status
   * @returns {Promise<Object>} Health status with system metrics
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest(() => this.client.get('/health'));
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        circuitBreaker: this.getCircuitBreakerStatus()
      };
    }
  }

  /**
   * Check ML service readiness
   * @returns {Promise<Object>} Readiness status
   */
  async readinessCheck() {
    try {
      const response = await this.makeRequest(() => this.client.get('/ready'));
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        circuitBreaker: this.getCircuitBreakerStatus()
      };
    }
  }

  /**
   * Get available classification classes
   * @returns {Promise<Object>} Available classes and total count
   */
  async getClasses() {
    try {
      const response = await this.makeRequest(() => this.client.get('/classes'));
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        circuitBreaker: this.getCircuitBreakerStatus()
      };
    }
  }

  /**
   * Predict infant cry classification for audio file
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<Object>} Prediction results with confidence scores
   */
  async predictAudio(audioFilePath) {
    try {
      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Validate file extension
      const ext = path.extname(audioFilePath).toLowerCase();
      const allowedFormats = ['.wav', '.mp3', '.m4a', '.flac'];
      if (!allowedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format: ${ext}. Allowed: ${allowedFormats.join(', ')}`);
      }

      // Create form data
      const formData = new FormData();
      const audioStream = fs.createReadStream(audioFilePath);
      formData.append('audio', audioStream, {
        filename: path.basename(audioFilePath),
        contentType: this.getContentType(ext)
      });

      // Make prediction request with circuit breaker protection
      const response = await this.makeRequest(() => 
        this.client.post('/predict', formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // Longer timeout for predictions
        })
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        circuitBreaker: this.getCircuitBreakerStatus()
      };
    }
  }

  /**
   * Predict infant cry classification with metadata (date_of_birth, history_data)
   * @param {string} audioFilePath - Path to the audio file
   * @param {string} dateOfBirth - Baby's date of birth (ISO 8601 format)
   * @param {Array} historyData - Array of historical cry analysis data
   * @param {string} babyId - Optional baby ID
   * @returns {Promise<Object>} Prediction results with AI recommendations
   */
  async predictWithMetadata(audioFilePath, dateOfBirth, historyData = [], babyId = null) {
    try {
      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Validate file extension
      const ext = path.extname(audioFilePath).toLowerCase();
      const allowedFormats = ['.wav', '.mp3', '.m4a', '.flac'];
      if (!allowedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format: ${ext}. Allowed: ${allowedFormats.join(', ')}`);
      }

      // Create form data
      const formData = new FormData();
      const audioStream = fs.createReadStream(audioFilePath);
      formData.append('audio', audioStream, {
        filename: path.basename(audioFilePath),
        contentType: this.getContentType(ext)
      });

      // Add metadata
      formData.append('date_of_birth', dateOfBirth);
      if (babyId) {
        formData.append('baby_id', babyId);
      }
      if (historyData && historyData.length > 0) {
        formData.append('history_data', JSON.stringify(historyData));
      }

      // Make prediction request with circuit breaker protection
      const response = await this.makeRequest(() => 
        this.client.post('/predict', formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // Longer timeout for predictions
        })
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        circuitBreaker: this.getCircuitBreakerStatus()
      };
    } finally {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(audioFilePath) && audioFilePath.includes('/temp/')) {
          await promisify(fs.unlink)(audioFilePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError.message);
      }
    }
  }

  /**
   * Get content type for audio file extension
   * @param {string} ext - File extension
   * @returns {string} Content type
   */
  getContentType(ext) {
    const contentTypes = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if ML service is available and healthy
   * @returns {Promise<boolean>} Service availability status
   */
  async isServiceAvailable() {
    try {
      // If circuit is open, service is not available
      if (this.circuitBreaker.state === CIRCUIT_STATES.OPEN) {
        return false;
      }

      const healthResult = await this.healthCheck();
      const readyResult = await this.readinessCheck();
      
      return healthResult.success && 
             readyResult.success && 
             healthResult.data?.status === 'healthy' &&
             readyResult.data?.ready === true;
    } catch (error) {
      console.error('ML Service availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Get detailed service status including health and classes
   * @returns {Promise<Object>} Comprehensive service status
   */
  async getServiceStatus() {
    try {
      const [healthResult, readyResult, classesResult] = await Promise.allSettled([
        this.healthCheck(),
        this.readinessCheck(),
        this.getClasses()
      ]);

      return {
        available: healthResult.status === 'fulfilled' && healthResult.value.success,
        health: healthResult.status === 'fulfilled' ? healthResult.value.data : null,
        ready: readyResult.status === 'fulfilled' ? readyResult.value.data : null,
        classes: classesResult.status === 'fulfilled' ? classesResult.value.data : null,
        baseURL: this.baseURL,
        circuitBreaker: this.getCircuitBreakerStatus(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        baseURL: this.baseURL,
        circuitBreaker: this.getCircuitBreakerStatus(),
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new MLService(); 