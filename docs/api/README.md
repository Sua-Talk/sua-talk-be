# SuaTalk API Documentation

This directory contains the complete API documentation for SuaTalk backend API using OpenAPI 3.0 specification.

## 📁 Documentation Structure

```
docs/api/
├── openapi-modular.yaml    # Main OpenAPI file (modular references)
├── openapi-bundled.yaml    # Complete bundled OpenAPI file
├── README.md               # This documentation guide
├── paths/                  # API endpoint definitions
│   ├── auth.yaml          # Authentication endpoints
│   ├── users.yaml         # User management endpoints
│   ├── babies.yaml        # Baby profile endpoints
│   ├── audio.yaml         # Audio recording endpoints
│   ├── ml.yaml            # Machine learning endpoints
│   ├── keys.yaml          # API key management endpoints
│   └── general.yaml       # General/utility endpoints
├── schemas/               # Data models and schemas
├── responses/             # Reusable response definitions
└── tools/                 # Documentation generation tools
```

## 🚀 Quick Start

### View Documentation
Open `openapi-bundled.yaml` in any OpenAPI viewer such as:
- [Swagger Editor](https://editor.swagger.io/)
- [Redoc](https://redoc.ly/)
- VS Code with OpenAPI extensions

### Generate Documentation
```bash
# Install dependencies
npm install

# Generate bundled documentation
npm run docs:build
```

## 🔐 Authentication Flow

### Recommended Registration Process (2-Step)

**Step 1: Email Verification**
```http
POST /api/auth/check-email
```
- User provides email address
- System checks availability and sends OTP
- OTP expires in 10 minutes

**Step 2: Complete Registration**
```http
POST /api/auth/complete-registration
```
- User provides OTP, password, and personal information
- System verifies OTP and creates account
- Email is automatically verified upon successful registration

### Legacy Registration Process (Deprecated)

The traditional flow using `/auth/register` → `/auth/verify-email` is still supported for backward compatibility but is deprecated. Please use the 2-step process above for new implementations.

### Login Process
```http
POST /api/auth/login
```
Returns JWT access token and refresh token for authenticated requests.

## 📊 Core Features

### 🍼 Baby Profile Management
- Create and manage baby profiles
- Track growth metrics (weight, height)
- Store feeding and sleep preferences
- Manage allergies and medications

### 🎵 Audio Recording & Analysis
- Record baby sounds and cries
- ML-powered cry analysis and classification
- Audio processing and storage
- Historical tracking and insights

### 🤖 Machine Learning Integration
- Advanced cry pattern recognition
- Emotional state detection
- Trend analysis and predictions
- Real-time audio processing

### 🔑 API Key Management
- Generate and manage API keys
- Set usage limits and permissions
- Monitor API usage analytics
- Secure access control

## 🔒 Security Features

### Authentication
- JWT-based authentication
- Secure refresh token rotation
- Session management
- Rate limiting protection

### Data Protection
- Input validation and sanitization
- CORS protection
- Request size limits
- SQL injection prevention

### Privacy
- User data encryption
- GDPR compliance ready
- Data retention policies
- Secure file uploads

## 📱 API Endpoints Overview

### Authentication (`/auth`)
- ✅ **2-Step Registration:** Email verification → Complete registration
- ✅ **Login/Logout:** JWT token management
- ✅ **Password Management:** Reset and change passwords
- ✅ **OAuth Integration:** Google OAuth support
- ⚠️ **Legacy Registration:** Deprecated traditional flow

### User Management (`/users`)
- Profile management
- Account settings
- Data export/deletion

### Baby Profiles (`/babies`)
- CRUD operations for baby profiles
- Growth tracking
- Medical information management

### Audio Processing (`/audio`)
- Audio upload and processing
- ML analysis results
- Historical recordings

### Machine Learning (`/ml`)
- Cry analysis and classification
- Pattern recognition
- Predictive insights

### API Keys (`/keys`)
- Key generation and management
- Usage analytics
- Access control

## 🌐 Environment Configuration

### Base URLs
- **Development:** `http://localhost:3000/api`
- **Production:** `https://api.suatalk.site`

### Rate Limits
- **Registration:** 5 requests per 15 minutes
- **Login:** 10 requests per 15 minutes
- **Password Reset:** 3 requests per 15 minutes
- **Email Verification:** 5 requests per 15 minutes
- **OAuth:** 10 requests per 15 minutes

### File Upload Limits
- **Audio Files:** 10MB max, WAV/MP3/M4A formats
- **Profile Images:** 5MB max, JPEG/PNG formats

## 📋 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "error": true,
  "message": "Error description",
  "errors": [
    // Detailed error information
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Development

### Testing the API
```bash
# Start development server
npm run dev

# Run API tests
npm test

# Test specific endpoints
npm run test:auth
npm run test:audio
```

### Documentation Updates
When updating API endpoints:

1. Update the corresponding YAML file in `paths/`
2. Update schemas in `schemas/` if needed
3. Regenerate bundled documentation
4. Test endpoints in Swagger UI

### Validation
- All requests are validated using express-validator
- Comprehensive error messages
- Input sanitization for security

## 📚 Additional Resources

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [SuaTalk API Postman Collection](./tools/postman-collection.json)
- [Authentication Guide](./docs/AUTHENTICATION.md)
- [ML Integration Guide](./docs/ML_INTEGRATION.md)

## 🆘 Support

For API support and questions:
- Create an issue in the project repository
- Check existing documentation
- Review API response error messages

---

**Note:** This API documentation is automatically generated and should be kept in sync with the actual implementation. 