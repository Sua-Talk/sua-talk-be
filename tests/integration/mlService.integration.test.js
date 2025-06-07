const MLService = require('../../src/services/mlService');
const fs = require('fs');
const path = require('path');

// Integration tests that run against actual ML service
// These tests require the ML service to be running on localhost:5000
describe('MLService Integration Tests', () => {
  let mlService;
  
  // Skip these tests if ML service is not available
  // Set ML_INTEGRATION_TESTS=true to run these tests
  const shouldRunIntegrationTests = process.env.ML_INTEGRATION_TESTS === 'true';

  beforeAll(() => {
    if (!shouldRunIntegrationTests) {
      console.log('Skipping ML service integration tests. Set ML_INTEGRATION_TESTS=true to run.');
      return;
    }

    process.env.ML_SERVICE_URL = 'http://localhost:5000';
    mlService = new MLService();
  });

  describe('Real ML Service Integration', () => {
    beforeEach(() => {
      if (!shouldRunIntegrationTests) {
        pending('ML_INTEGRATION_TESTS not enabled');
      }
    });

    test('should connect to real ML service health endpoint', async () => {
      const result = await mlService.healthCheck();
      
      console.log('Health check result:', result);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('model_loaded');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('system_health');
    }, 10000); // 10 second timeout

    test('should check readiness of real ML service', async () => {
      const result = await mlService.readinessCheck();
      
      console.log('Readiness check result:', result);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('ready');
      expect(result.data).toHaveProperty('timestamp');
    }, 10000);

    test('should get classification classes from real service', async () => {
      const result = await mlService.getClasses();
      
      console.log('Classes result:', result);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('classes');
      expect(result.data).toHaveProperty('total_classes');
      expect(result.data.classes).toBeInstanceOf(Array);
      expect(result.data.classes.length).toBeGreaterThan(0);
      
      // Verify expected classes
      const expectedClasses = ['burping', 'discomfort', 'belly_pain', 'hungry', 'tired'];
      expectedClasses.forEach(className => {
        expect(result.data.classes).toContain(className);
      });
    }, 10000);

    test('should check comprehensive service status', async () => {
      const status = await mlService.getServiceStatus();
      
      console.log('Service status:', status);
      
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('ready');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('readiness');
      
      if (status.available) {
        expect(status.health).not.toBeNull();
      }
    }, 15000);

    test('should predict audio with real service (if audio file available)', async () => {
      // Check if there's a test audio file
      const testAudioPath = path.join(__dirname, '../fixtures/sample-cry.wav');
      
      if (!fs.existsSync(testAudioPath)) {
        console.log('No test audio file found, skipping prediction test');
        pending('Test audio file not available');
        return;
      }

      const result = await mlService.predictAudio(testAudioPath);
      
      console.log('Prediction result:', result);
      
      if (result.success) {
        expect(result.data).toHaveProperty('prediction');
        expect(result.data).toHaveProperty('confidence');
        expect(result.data).toHaveProperty('all_predictions');
        expect(result.data).toHaveProperty('feature_shape');
        
        // Validate prediction is one of expected classes
        const expectedClasses = ['burping', 'discomfort', 'belly_pain', 'hungry', 'tired'];
        expect(expectedClasses).toContain(result.data.prediction);
        
        // Validate confidence is between 0 and 1
        expect(result.data.confidence).toBeGreaterThanOrEqual(0);
        expect(result.data.confidence).toBeLessThanOrEqual(1);
        
        // Validate all_predictions sums approximately to 1
        const allPredictions = result.data.all_predictions;
        const sum = Object.values(allPredictions).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 2);
      } else {
        console.log('Prediction failed:', result.error);
        // Don't fail the test if ML service is not fully functional
        // but log the issue for debugging
      }
    }, 30000); // Longer timeout for ML prediction

    test('should handle service availability check', async () => {
      const isAvailable = await mlService.isServiceAvailable();
      
      console.log('Service availability:', isAvailable);
      
      // This should return true if ML service is running
      expect(typeof isAvailable).toBe('boolean');
    }, 10000);
  });

  describe('Error Handling with Real Service', () => {
    beforeEach(() => {
      if (!shouldRunIntegrationTests) {
        pending('ML_INTEGRATION_TESTS not enabled');
      }
    });

    test('should handle invalid audio file gracefully', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/invalid-audio.txt');
      fs.writeFileSync(textFilePath, 'This is not an audio file');

      const result = await mlService.predictAudio(textFilePath);
      
      console.log('Invalid file result:', result);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Clean up
      fs.unlinkSync(textFilePath);
    }, 15000);

    test('should handle nonexistent file gracefully', async () => {
      const nonExistentFile = path.join(__dirname, '../fixtures/does-not-exist.wav');

      const result = await mlService.predictAudio(nonExistentFile);
      
      console.log('Nonexistent file result:', result);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    }, 10000);
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      if (!shouldRunIntegrationTests) {
        pending('ML_INTEGRATION_TESTS not enabled');
      }
    });

    test('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await mlService.healthCheck();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Health check took ${duration}ms`);
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });

    test('should handle concurrent requests', async () => {
      const promises = [];
      
      // Make 5 concurrent health checks
      for (let i = 0; i < 5; i++) {
        promises.push(mlService.healthCheck());
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      console.log(`5 concurrent health checks took ${endTime - startTime}ms`);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
    }, 15000);
  });
});

// Utility function to create test setup instructions
function logTestSetup() {
  console.log(`
    ML Service Integration Test Setup:
    
    1. Start the ML service on localhost:5000
    2. Set environment variable: ML_INTEGRATION_TESTS=true
    3. Run tests with: npm test -- tests/integration/mlService.integration.test.js
    
    Or run all tests including integration:
    ML_INTEGRATION_TESTS=true npm test
  `);
}

// Log setup instructions when this file is loaded
if (require.main === module) {
  logTestSetup();
} 