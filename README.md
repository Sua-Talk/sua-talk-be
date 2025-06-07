# SuaTalk Backend API

Baby voice and emotion detection application backend service built with Express.js and MongoDB.

## 🌐 API Architecture

- **Production API**: https://api.suatalk.site
- **Production Frontend**: https://suatalk.site  
- **Development**: http://localhost:3000

The API uses subdomain-based architecture for better separation and scalability.

## 🚀 Features

- 🔐 **Authentication & Authorization** - JWT-based auth with email verification
- 👤 **User Management** - Profile management with photo uploads
- 🍼 **Baby Profiles** - Multiple baby profiles per user
- 🎵 **Audio Processing** - Audio file upload and ML analysis
- 🤖 **ML Integration** - Real-time baby cry emotion detection
- 📧 **Email Service** - OTP verification and password reset
- 🔒 **Security** - Rate limiting, input validation, and security headers
- 📊 **Monitoring** - Health checks and comprehensive logging

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT with Passport.js
- **File Upload:** Multer
- **Email:** Nodemailer
- **Image Processing:** Sharp
- **Security:** Helmet, CORS, Rate limiting

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sua-talk-be
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `SMTP_*` - Email service configuration
- `ML_SERVICE_URL` - ML service endpoint
- `GOOGLE_CLIENT_*` - OAuth configuration

## 🚦 API Endpoints

### Base URL
- **Production**: `https://api.suatalk.site`
- **Development**: `http://localhost:3000`

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/verify-email` - Email verification
- `POST /auth/login` - User login
- `POST /auth/refresh-token` - Token refresh
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset
- `GET /auth/google` - Google OAuth

### User Management
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `POST /users/upload-avatar` - Upload profile picture

### Baby Profiles
- `GET /babies` - Get all baby profiles
- `POST /babies` - Create baby profile
- `PUT /babies/:id` - Update baby profile
- `DELETE /babies/:id` - Delete baby profile

### Audio Management
- `POST /audio/upload` - Upload audio file
- `GET /audio/recordings` - Get recordings
- `POST /audio/analyze/:id` - Trigger ML analysis

### Machine Learning
- `GET /ml/status` - ML service status
- `GET /ml/classes` - Available emotion classes
- `POST /ml/analyze/:recordingId` - Trigger ML analysis
- `GET /ml/analysis/:recordingId` - Get analysis result
- `GET /ml/history/:userId` - Get analysis history
- `GET /ml/stats/:userId` - Get analysis statistics

### System
- `GET /health` - Health check endpoint
- `GET /` - API information and available endpoints

## 🧪 Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Mongoose models
├── routes/         # API routes
├── services/       # Business logic services
├── utils/          # Helper utilities
└── app.js          # Express app setup
```

## 🐳 Deployment

### Subdomain Setup

For production deployment with subdomain architecture:

1. **Configure DNS records** for `api.suatalk.site`
2. **Setup Nginx reverse proxy** for subdomain routing
3. **Install SSL certificates** for both domains
4. **Deploy backend** with PM2 clustering
5. **Configure environment variables** for production

See [docs/SUBDOMAIN_SETUP.md](docs/SUBDOMAIN_SETUP.md) for detailed deployment instructions.

### Traditional Deployment

This application can also be deployed using CapRover, Docker, or any Node.js hosting platform:

1. **Build Docker image**
2. **Deploy to hosting platform**
3. **Configure environment variables**
4. **Setup MongoDB database**
5. **Configure ML service integration**

## 📝 License

ISC License - SuaTalk Team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📞 Support

For support and questions, please contact the SuaTalk development team. 