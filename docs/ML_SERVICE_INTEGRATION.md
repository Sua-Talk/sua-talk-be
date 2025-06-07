# ML Service Integration Guide

## Overview

The SuaTalk backend integrates with a Python-based Machine Learning service to analyze baby cry audio recordings and classify emotions. This document describes the integration architecture, setup procedures, and usage patterns.

## Architecture

### Components

1. **ML Service Client** (`src/services/mlService.js`)
   - HTTP client for communicating with the ML service
   - Environment-based URL configuration
   - Comprehensive error handling and retry logic
   - File upload handling with proper content-type detection

2. **Background Job Processing** (`src/jobs/jobManager.js`)
   - Agenda.js-based job scheduling for ML analysis
   - Exponential backoff retry strategy
   - Job monitoring and graceful shutdown handling

3. **API Controllers** (`src/controllers/mlController.js`)
   - RESTful endpoints for ML service interaction
   - Status checks, analysis triggering, and result retrieval
   - Comprehensive validation and error handling

4. **Database Integration** (`src/models/AudioRecording.js`)
   - Extended AudioRecording model with ML analysis results
   - Status tracking and analysis lifecycle management

## ML Service Endpoints

### Health Check - `GET /health`
Returns comprehensive system information:
```json
{
  "environment": "development",
  "model_loaded": true,
  "model_loaded_time": "2025-06-07T08:42:30.596025",
  "model_path": "classification_model/classifier_model.h5",
  "status": "healthy",
  "system_health": {
    "cpu_count": 16,
    "disk_percent": 1.0155322113488083,
    "memory_percent": 11.3
  },
  "timestamp": "2025-06-07T08:59:22.198796",
  "uptime_seconds": 1011.602837,
  "version": "1.0.0"
}
```

### Readiness Check - `GET /ready`
Returns service readiness status:
```json
{
  "ready": true,
  "timestamp": "2025-06-07T08:59:25.020664"
}
```

### Classification Classes - `GET /classes`
Returns available emotion classes:
```json
{
  "classes": [
    "burping",
    "discomfort", 
    "belly_pain",
    "hungry",
    "tired"
  ],
  "total_classes": 5
}
```

### Prediction - `POST /predict`
Analyzes audio file and returns prediction:
```json
{
  "all_predictions": {
    "belly_pain": 0.00022667452867608517,
    "burping": 0.997020423412323,
    "discomfort": 0.00014403856766875833,
    "hungry": 0.0020525241270661354,
    "tired": 0.0005563849699683487
  },
  "confidence": 0.997020423412323,
  "feature_shape": [1, 167],
  "prediction": "burping"
}
```

## Configuration

### Environment Variables

Set in `.env` for development or production environment:

```bash
# ML Service Configuration
ML_SERVICE_URL=http://localhost:5000  # Development
# ML_SERVICE_URL=http://srv-captain--ml:5000  # Production (CapRover)

# Database Configuration (for tests)
MONGODB_URI=mongodb://localhost:27017/sua-talk-test

# Security
JWT_SECRET=your-jwt-secret-key
```

### Production Configuration

For CapRover deployment:
```bash
ML_SERVICE_URL=http://srv-captain--ml:5000
```

## API Usage

### Backend Integration Endpoints

#### 1. Check ML Service Status
```http
GET https://api.suatalk.site/ml/status
Authorization: Bearer <jwt-token>
```

#### 2. Get Available Classes
```http
GET https://api.suatalk.site/ml/classes
Authorization: Bearer <jwt-token>
```

#### 3. Trigger ML Analysis
```http
POST https://api.suatalk.site/ml/analyze/:recordingId
Authorization: Bearer <jwt-token>
```

#### 4. Get Analysis Result
```http
GET https://api.suatalk.site/ml/analysis/:recordingId
Authorization: Bearer <jwt-token>
```

#### 5. Get Analysis History
```http
GET https://api.suatalk.site/ml/history/:userId?page=1&limit=10&status=completed&prediction=hungry
Authorization: Bearer <jwt-token>
```

#### 6. Get Analysis Statistics
```http
GET https://api.suatalk.site/ml/stats/:userId
Authorization: Bearer <jwt-token>
```

### Auto-Analysis Integration

Audio recordings automatically trigger ML analysis after successful upload:

```javascript
// Upload audio - analysis is queued automatically
POST https://api.suatalk.site/audio/upload
// Response includes analysis queue status:
{
  "success": true,
  "data": {
    "recording": { /* recording data */ },
    "analysis": {
      "queued": true,
      "queuedAt": "2025-06-07T09:00:00.000Z"
    }
  }
}
```

### Rate Limiting

- **Analysis requests**: 10 requests per 5 minutes per user
- **Query requests**: 30 requests per minute per user

## Development Setup

### 1. Prerequisites

- Node.js 18+
- MongoDB
- Python ML service running on localhost:5000

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Services

```bash
# Start MongoDB
mongod

# Start ML Service (in separate terminal)
cd sua-talk-ml
python app.py

# Start Backend (in separate terminal)
npm run dev
```

## Testing

### Unit Tests
```bash
# Run unit tests with mocked ML service
npm run test:unit
```

### Integration Tests
```bash
# Start ML service first on localhost:5000
cd sua-talk-ml && python app.py

# Run integration tests against real ML service
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

### Test Files Structure
```
tests/
├── setup.js                      # Global test configuration
├── fixtures/                     # Test data files
│   ├── test-audio.wav            # Generated by tests
│   └── sample-cry.wav            # Optional real audio file
├── services/
│   └── mlService.test.js         # Unit tests with mocked responses
└── integration/
    └── mlService.integration.test.js  # Integration tests with real service
```

## Error Handling

### Service Availability
- Circuit breaker pattern for service failures
- Graceful degradation when ML service is unavailable
- Automatic retries with exponential backoff

### Common Error Scenarios

1. **ML Service Unavailable**
   - Returns 503 status with appropriate error message
   - Jobs are retried automatically up to 3 times

2. **Invalid Audio Format**
   - Returns 400 status with validation error
   - Supported formats: WAV, MP3, OGG, M4A

3. **File Size Limits**
   - Maximum file size: 10MB
   - Returns 413 status if exceeded

4. **Analysis Timeout**
   - 30-second timeout for ML predictions
   - Jobs are retried with exponential backoff

## Monitoring

### Health Checks
- `https://api.suatalk.site/ml/status` - Comprehensive ML service status
- Application logs include ML service availability
- Job manager reports queue status and failures

### Metrics
- Analysis success/failure rates
- Response times for ML service calls
- Queue depth and processing times
- Error rates by error type

## Deployment

### Docker Configuration

For containerized deployment, ensure ML service container is accessible:

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - ML_SERVICE_URL=http://ml-service:5000
  
  ml-service:
    # ML service container configuration
    ports:
      - "5000:5000"
```

### CapRover Deployment

1. Deploy ML service as separate app
2. Configure ML_SERVICE_URL to internal service URL
3. Ensure network connectivity between services

### Environment-Specific URLs

- **Development**: `http://localhost:5000`
- **Production (CapRover)**: `http://srv-captain--ml:5000`
- **Docker Compose**: `http://ml-service:5000`

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify ML service is running on correct port
   - Check firewall/network configuration
   - Verify ML_SERVICE_URL environment variable

2. **Prediction Failures**
   - Check audio file format and size
   - Verify ML model is loaded properly
   - Check ML service logs for errors

3. **Timeout Errors**
   - Increase timeout values if needed
   - Check ML service performance
   - Monitor system resources

### Debug Mode

Enable detailed logging:
```bash
DEBUG=ml-service npm run dev
```

### Health Check Commands

```bash
# Check ML service directly
curl http://localhost:5000/health

# Check through backend API
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/ml/status
```

## Security Considerations

- All ML endpoints require JWT authentication
- Rate limiting prevents abuse
- File type validation prevents malicious uploads
- No sensitive data is logged
- ML service communication over HTTP (use HTTPS in production)

## Performance Optimization

- Background job processing prevents blocking requests
- Connection pooling for ML service calls
- Caching of ML service status checks
- Batch processing capabilities for multiple recordings

## Future Enhancements

- Real-time analysis via WebSocket connections
- ML model versioning and A/B testing
- Enhanced caching strategies
- Distributed job processing
- Advanced analytics and reporting 