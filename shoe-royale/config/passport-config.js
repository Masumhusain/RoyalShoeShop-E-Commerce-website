const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    console.log(`🔐 Login attempt for: ${email}`);
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // User not found
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return done(null, false, { message: 'Invalid email or password' });
    }
    
    // Check if account is locked
    if (user.isLocked()) {
      console.log(`🔒 Account locked: ${email}`);
      return done(null, false, { 
        message: 'Account is temporarily locked. Please try again later.' 
      });
    }
    
    // Check password
    console.log(`🔑 Comparing password for: ${email}`);
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log(`❌ Invalid password for: ${email}`);
      
      try {
        // Increment login attempts
        await user.incLoginAttempts();
        
        // Check if locked now
        const updatedUser = await User.findById(user._id);
        
        if (updatedUser.isLocked()) {
          return done(null, false, { 
            message: 'Too many failed attempts. Account locked for 2 hours.' 
          });
        }
        
        const attemptsLeft = 5 - updatedUser.loginAttempts;
        const message = `Invalid password. ${attemptsLeft} attempt(s) remaining.`;
        
        return done(null, false, { message });
      } catch (error) {
        console.error('Error updating login attempts:', error);
        return done(null, false, { message: 'Invalid password' });
      }
    }
    
    console.log(`✅ Password correct for: ${email}`);
    
    // Reset login attempts and update last login
    await user.resetLoginAttempts();
    
    return done(null, user);
  } catch (error) {
    console.error('❌ Passport error:', error);
    return done(error);
  }
}));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

console.log('✅ Passport Local Strategy initialized');

module.exports = passport;