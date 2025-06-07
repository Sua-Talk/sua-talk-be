const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const jwtService = require('../services/jwtService');

// JWT Strategy Configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_ACCESS_SECRET || 'your-super-secret-jwt-key',
  passReqToCallback: true // Pass the request to the verify callback
};

// JWT Strategy
passport.use('jwt', new JwtStrategy(jwtOptions, async (req, jwtPayload, done) => {
  try {
    // Validate JWT payload structure
    if (!jwtPayload.userId || !jwtPayload.type) {
      return done(null, false, { message: 'Invalid token structure' });
    }

    // Ensure this is an access token
    if (jwtPayload.type !== 'access') {
      return done(null, false, { message: 'Invalid token type' });
    }

    // Check if token is expired
    if (jwtPayload.exp && Date.now() >= jwtPayload.exp * 1000) {
      return done(null, false, { message: 'Token expired' });
    }

    // Find user by ID
    const user = await User.findById(jwtPayload.userId);
    
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }

    // Check if user account is active
    if (!user.isActive) {
      return done(null, false, { message: 'Account deactivated' });
    }

    // Check if email is verified (for certain protected routes)
    if (!user.isEmailVerified) {
      return done(null, false, { message: 'Email not verified' });
    }

    // Attach user to request object
    return done(null, user);
    
  } catch (error) {
    console.error('JWT Strategy Error:', error);
    return done(error, false);
  }
}));

// Optional: Configure session serialization (not needed for JWT)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 