# SuaTalk Backend API

Baby voice and emotion detection application backend service built with Express.js and MongoDB.

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

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Token refresh
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset
- `GET /api/auth/google` - Google OAuth

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/upload-avatar` - Upload profile picture

### Baby Profiles
- `GET /api/babies` - Get all baby profiles
- `POST /api/babies` - Create baby profile
- `PUT /api/babies/:id` - Update baby profile
- `DELETE /api/babies/:id` - Delete baby profile

### Audio Management
- `POST /api/audio/upload` - Upload audio file
- `GET /api/audio/recordings` - Get recordings
- `POST /api/audio/analyze/:id` - Trigger ML analysis

### System
- `GET /health` - Health check endpoint

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

This application is designed to be deployed using CapRover on Digital Ocean:

1. **Build Docker image**
2. **Deploy to CapRover**
3. **Configure environment variables**
4. **Setup MongoDB container**
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