const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  avatar: {
    type: String,
    default: '/images/default-avatar.png'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  newsletterSubscription: {
    type: Boolean,
    default: false
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Method 1: Hash password manually before saving in the route
// (We'll handle password hashing in the route itself)

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw error;
  }
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  if (!this.lockUntil) return false;
  return this.lockUntil > Date.now();
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  try {
    // If lock has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
      this.loginAttempts = 1;
      this.lockUntil = undefined;
    } else {
      // Otherwise increment
      this.loginAttempts += 1;
    }
    
    // Lock the account if login attempts exceed 5
    if (this.loginAttempts >= 5 && !this.isLocked()) {
      this.lockUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 hours lock
    }
    
    return await this.save();
  } catch (error) {
    console.error('Error incrementing login attempts:', error);
    throw error;
  }
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function() {
  try {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    this.lastLogin = Date.now();
    
    return await this.save();
  } catch (error) {
    console.error('Error resetting login attempts:', error);
    throw error;
  }
};

// Add toJSON method to remove password from responses
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;