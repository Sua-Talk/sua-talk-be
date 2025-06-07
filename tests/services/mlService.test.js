const nock = require('nock');
const fs = require('fs');
const path = require('path');

// Mock audio file for testing
const mockAudioFilePath = path.join(__dirname, '../fixtures/test-audio.wav');

describe('MLService', () => {
  let mlService;
  const mockBaseURL = 'http://localhost:5000';

  beforeAll(() => {
    // Set environment variable for testing
    process.env.ML_SERVICE_URL = mockBaseURL;
    // Import after setting environment variable
    mlService = require('../../src/services/mlService');
  });

  beforeEach(() => {
    // Clean up any pending mocks
    nock.cleanAll();
  });

  afterAll(() => {
    // Clean up nock
    nock.cleanAll();
    nock.restore();
  });

  describe('Health Check', () => {
    test('should return health status successfully', async () => {
      const mockHealthResponse = {
        environment: "development",
        model_loaded: true,
        model_loaded_time: "2025-06-07T08:42:30.596025",
        model_path: "classification_model/classifier_model.h5",
        status: "healthy",
        system_health: {
          cpu_count: 16,
          disk_percent: 1.0155322113488083,
          memory_percent: 11.3
        },
        timestamp: "2025-06-07T08:59:22.198796",
        uptime_seconds: 1011.602837,
        version: "1.0.0"
      };

      nock(mockBaseURL)
        .get('/health')
        .reply(200, mockHealthResponse);

      const result = await mlService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHealthResponse);
      expect(result.data.status).toBe('healthy');
      expect(result.data.model_loaded).toBe(true);
    });

    test('should handle health check service error', async () => {
      nock(mockBaseURL)
        .get('/health')
        .reply(503, { error: 'Service unavailable' });

      const result = await mlService.healthCheck();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request failed with status code 503');
    });

    test('should handle network timeout', async () => {
      nock(mockBaseURL)
        .get('/health')
        .delay(31000) // Longer than 30s timeout
        .reply(200, { status: 'healthy' });

      const result = await mlService.healthCheck();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 35000); // Increase test timeout to 35 seconds
  });

  describe('Readiness Check', () => {
    test('should return readiness status successfully', async () => {
      const mockReadyResponse = {
        ready: true,
        timestamp: "2025-06-07T08:59:25.020664"
      };

      nock(mockBaseURL)
        .get('/ready')
        .reply(200, mockReadyResponse);

      const result = await mlService.readinessCheck();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReadyResponse);
      expect(result.data.ready).toBe(true);
    });

    test('should handle readiness check failure', async () => {
      nock(mockBaseURL)
        .get('/ready')
        .reply(503, { ready: false, error: 'Model not loaded' });

      const result = await mlService.readinessCheck();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request failed with status code 503');
    });
  });

  describe('Get Classes', () => {
    test('should return available classes successfully', async () => {
      const mockClassesResponse = {
        classes: [
          "burping",
          "discomfort",
          "belly_pain",
          "hungry",
          "tired"
        ],
        total_classes: 5
      };

      nock(mockBaseURL)
        .get('/classes')
        .reply(200, mockClassesResponse);

      const result = await mlService.getClasses();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockClassesResponse);
      expect(result.data.classes).toHaveLength(5);
      expect(result.data.classes).toContain('burping');
      expect(result.data.classes).toContain('hungry');
    });

    test('should handle get classes error', async () => {
      nock(mockBaseURL)
        .get('/classes')
        .reply(500, { error: 'Internal server error' });

      const result = await mlService.getClasses();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request failed with status code 500');
    });
  });

  describe('Predict Audio', () => {
    // Create a mock audio file for testing
    beforeAll(() => {
      const mockAudioDir = path.dirname(mockAudioFilePath);
      if (!fs.existsSync(mockAudioDir)) {
        fs.mkdirSync(mockAudioDir, { recursive: true });
      }
      // Create a minimal WAV file for testing
      const mockWavContent = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x00, 0x00, 0x00, // File size
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6d, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Format chunk size
        0x01, 0x00, // Audio format (PCM)
        0x01, 0x00, // Number of channels
        0x40, 0x1f, 0x00, 0x00, // Sample rate
        0x80, 0x3e, 0x00, 0x00, // Byte rate
        0x02, 0x00, // Block align
        0x10, 0x00, // Bits per sample
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x00, 0x00, 0x00  // Data size
      ]);
      fs.writeFileSync(mockAudioFilePath, mockWavContent);
    });

    afterAll(() => {
      // Clean up mock file
      if (fs.existsSync(mockAudioFilePath)) {
        fs.unlinkSync(mockAudioFilePath);
      }
    });

    test('should predict audio successfully', async () => {
      const mockPredictResponse = {
        all_predictions: {
          belly_pain: 0.00022667452867608517,
          burping: 0.997020423412323,
          discomfort: 0.00014403856766875833,
          hungry: 0.0020525241270661354,
          tired: 0.0005563849699683487
        },
        confidence: 0.997020423412323,
        feature_shape: [1, 167],
        prediction: "burping"
      };

      nock(mockBaseURL)
        .post('/predict')
        .reply(200, mockPredictResponse);

      const result = await mlService.predictAudio(mockAudioFilePath);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPredictResponse);
      expect(result.data.prediction).toBe('burping');
      expect(result.data.confidence).toBeGreaterThan(0.9);
      expect(result.data.all_predictions).toHaveProperty('burping');
      expect(result.data.feature_shape).toEqual([1, 167]);
    });

    test('should handle file not found error', async () => {
      const nonExistentFile = '/path/to/nonexistent/file.wav';

      const result = await mlService.predictAudio(nonExistentFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Audio file not found');
    });

    test('should handle invalid file format', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an audio file');

      const result = await mlService.predictAudio(textFilePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported audio format');

      // Clean up
      fs.unlinkSync(textFilePath);
    });

    test('should handle ML service prediction error', async () => {
      nock(mockBaseURL)
        .post('/predict')
        .reply(500, { error: 'Model prediction failed' });

      const result = await mlService.predictAudio(mockAudioFilePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request failed with status code 500');
    });

    test('should handle unsupported file extension', async () => {
      const unsupportedFile = path.join(__dirname, '../fixtures/test.xyz');
      fs.writeFileSync(unsupportedFile, 'dummy content');

      const result = await mlService.predictAudio(unsupportedFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported audio format');

      // Clean up
      fs.unlinkSync(unsupportedFile);
    });
  });

  describe('Service Availability', () => {
    test('should check if service is available', async () => {
      nock(mockBaseURL)
        .get('/health')
        .reply(200, { status: 'healthy' });

      nock(mockBaseURL)
        .get('/ready')
        .reply(200, { ready: true });

      const isAvailable = await mlService.isServiceAvailable();

      expect(isAvailable).toBe(true);
    });

    test('should return false when service is not available', async () => {
      nock(mockBaseURL)
        .get('/health')
        .reply(503, { status: 'unhealthy' });

      const isAvailable = await mlService.isServiceAvailable();

      expect(isAvailable).toBe(false);
    });

    test('should return false on network error', async () => {
      nock(mockBaseURL)
        .get('/health')
        .replyWithError('Network error');

      const isAvailable = await mlService.isServiceAvailable();

      expect(isAvailable).toBe(false);
    });
  });

  describe('Service Status', () => {
    test('should get comprehensive service status', async () => {
      const mockHealthData = {
        status: 'healthy',
        model_loaded: true,
        version: '1.0.0'
      };

      const mockReadyData = {
        ready: true,
        timestamp: '2025-06-07T08:59:25.020664'
      };

      const mockClassesData = {
        classes: ['burping', 'hungry'],
        total_classes: 2
      };

      nock(mockBaseURL)
        .get('/health')
        .reply(200, mockHealthData);

      nock(mockBaseURL)
        .get('/ready')
        .reply(200, mockReadyData);

      nock(mockBaseURL)
        .get('/classes')
        .reply(200, mockClassesData);

      const status = await mlService.getServiceStatus();

      expect(status.available).toBe(true);
      expect(status.health).toEqual(mockHealthData);
      expect(status.ready).toEqual(mockReadyData);
      expect(status.classes).toEqual(mockClassesData);
    });

    test('should handle mixed service status', async () => {
      nock(mockBaseURL)
        .get('/health')
        .reply(200, { status: 'healthy', model_loaded: true });

      nock(mockBaseURL)
        .get('/ready')
        .reply(503, { ready: false });

      nock(mockBaseURL)
        .get('/classes')
        .reply(500, { error: 'Internal error' });

      const status = await mlService.getServiceStatus();

      expect(status.available).toBe(true);
      expect(status.health).toBeDefined();
      expect(status.ready).toBeNull();
      expect(status.classes).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network connection refused', async () => {
      // Test with a different base URL that's not mocked
      const mockFailedURL = 'http://localhost:9999';
      
      nock(mockFailedURL)
        .get('/health')
        .replyWithError('ECONNREFUSED');

      // Temporarily change the service baseURL
      const originalBaseURL = mlService.baseURL;
      mlService.baseURL = mockFailedURL;
      mlService.client.defaults.baseURL = mockFailedURL;

      const result = await mlService.healthCheck();

      // Restore original baseURL
      mlService.baseURL = originalBaseURL;
      mlService.client.defaults.baseURL = originalBaseURL;

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });

    test('should handle 204 No Content response gracefully', async () => {
      // Test empty response with 204 status
      nock(mockBaseURL)
        .get('/classes')
        .reply(204);

      const result = await mlService.getClasses();

      // This should succeed with axios (204 is a valid response)
      expect(result.success).toBe(true);
      expect(result.data).toEqual('');
    });

    test('should handle invalid content type', async () => {
      // Test HTML response when JSON expected
      nock(mockBaseURL)
        .get('/health')
        .reply(200, '<html><body>Server Error</body></html>', {
          'Content-Type': 'text/html'
        });

      const result = await mlService.healthCheck();

      // Axios will parse this as text, which should work
      expect(result.success).toBe(true);
      expect(result.data).toContain('<html>');
    });
  });
}); 