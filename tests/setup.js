// Global test setup
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/sua-talk-test';
process.env.ML_SERVICE_URL = 'http://localhost:5000';

// Extend Jest timeout for ML service operations
jest.setTimeout(30000);

// Mock console.log in tests to reduce noise (comment out if you need debug logs)
global.console = {
  ...console,
  // Uncomment the line below to suppress console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper function to wait for a specified time
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test user data
  generateTestUser: () => ({
    fullName: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'testPassword123',
    phone: '+1234567890',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'other',
    role: 'user'
  }),
  
  // Helper to generate test audio recording data
  generateTestAudioRecording: () => ({
    filename: `test-audio-${Date.now()}.wav`,
    originalName: 'test-cry.wav',
    mimeType: 'audio/wav',
    size: 1024000,
    duration: 5.2,
    uploadedAt: new Date(),
    analysisStatus: 'pending'
  }),
  
  // Helper to check if ML service is available
  async checkMLServiceAvailability() {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:5000/health', { 
        timeout: 5000 
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
};

// Setup before all tests
beforeAll(async () => {
  // Check if ML service is available for integration tests
  const mlAvailable = await global.testUtils.checkMLServiceAvailability();
  if (!mlAvailable && process.env.ML_INTEGRATION_TESTS === 'true') {
    console.warn(`
      ⚠️  ML Service not available on localhost:5000
      Integration tests may fail. Start the ML service with:
      cd sua-talk-ml && python app.py
    `);
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Add any global cleanup here
  if (global.gc) {
    global.gc();
  }
}); 