require('dotenv').config();
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  issuer: 'suatalk-api',
  audience: 'suatalk-app'
}, async (payload, done) => {
  try {
    // Check if token is expired
    if (Date.now() >= payload.exp * 1000) {
      return done(null, false, { message: 'Token expired' });
    }

    // Find user by ID from JWT payload
    const user = await User.findById(payload.sub).select('-password');
    
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }

    // Check if user account is active
    if (!user.isActive) {
      return done(null, false, { message: 'Account is deactivated' });
    }

    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id: googleId, emails, displayName, photos } = profile;
    const email = emails?.[0]?.value;
    const profilePicture = photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email provided by Google'), null);
    }

    // Check if user already exists with this Google ID
    let user = await User.findOne({ 'oauth.google.id': googleId });

    if (user) {
      // User exists with this Google ID, return user
      return done(null, user);
    }

    // Check if user exists with this email (account linking)
    user = await User.findOne({ email });

    if (user) {
      // Link Google account to existing user
      user.oauth = {
        ...user.oauth,
        google: {
          id: googleId,
          email,
          profilePicture
        }
      };
      
      // Mark email as verified since it's verified by Google
      user.isEmailVerified = true;
      
      await user.save();
      return done(null, user);
    }

    // Create new user with Google OAuth
    const [firstName, ...lastNameParts] = displayName.split(' ');
    const lastName = lastNameParts.join(' ');

    user = new User({
      email,
      firstName: firstName || 'User',
      lastName: lastName || '',
      isEmailVerified: true, // Google emails are pre-verified
      oauth: {
        google: {
          id: googleId,
          email,
          profilePicture
        }
      },
      // Generate a random password (won't be used for OAuth users)
      password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
    });

    await user.save();
    return done(null, user);

  } catch (error) {
    return done(error, null);
  }
}));

// Serialize user for session (used in OAuth flow)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 