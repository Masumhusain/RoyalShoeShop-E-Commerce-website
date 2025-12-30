require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const methodOverride = require('method-override');
const connectDB = require('./config/database');
const { ensureAuthenticated, ensureAdmin } = require('./middleware/auth');
const bcrypt = require('bcryptjs');
const ExpressError = require('./utils/ExpressError');
const wrapAsync = require("./utils/wrapAsync");

// Import models
const Product = require('./models/Product');
const User = require('./models/User');

// Import routes
const adminRoutes = require('./routes/admin');

// Import Passport configuration
require('./config/passport-config');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'royal-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.title = 'Royal Footwear';
  next();
});

// ==================== ROUTES ====================
// Use admin routes
app.use('/admin', adminRoutes);

// Simple admin login page
app.get('/admin-login', (req, res) => {
    res.render('auth/simple-admin-login', {
        title: 'Admin Login',
        error_msg: req.flash('error_msg'),
        user: null
    });
});

// Simple admin login handler
app.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            req.flash('error_msg', 'Admin not found');
            return res.redirect('/admin-login');
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            req.flash('error_msg', 'Invalid password');
            return res.redirect('/admin-login');
        }
        
        if (user.role !== 'admin') {
            req.flash('error_msg', 'Not an admin account');
            return res.redirect('/admin-login');
        }
        
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        req.flash('success_msg', 'Admin login successful');
        return res.redirect('/admin/dashboard');
        
    } catch (error) {
        console.error('Admin login error:', error);
        req.flash('error_msg', 'Login failed');
        res.redirect('/admin-login');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});


// Home route
app.get('/', async (req, res) => {
  try {
    console.log('🏠 GET / - Rendering home page');
    
    const featuredProducts = await Product.find({ 
      featured: true,
      'sizes.quantity': { $gt: 0 }
    })
    .limit(8)
    .sort({ createdAt: -1 })
    .lean();
    
    // Get category images
    const categoryImages = {};
    const categories = ['sneakers', 'formal', 'boots', 'sandals', 'sports', 'loafers'];
    
    for (const category of categories) {
      const product = await Product.findOne({ 
        category: category,
        'sizes.quantity': { $gt: 0 }
      })
      .sort({ createdAt: -1 })
      .lean();
      
      if (product?.colors?.[0]?.images?.[0]?.url) {
        categoryImages[category] = product.colors[0].images[0].url;
      }
    }
    
    // Get hero image
    let heroImage = '/images/hero-shoe.png';
    if (featuredProducts.length > 0) {
      const heroProduct = featuredProducts[0];
      if (heroProduct?.colors?.[0]?.images?.[0]?.url) {
        heroImage = heroProduct.colors[0].images[0].url;
      }
    }
    
    // Enhance featured products with images
    const enhancedProducts = featuredProducts.map(product => {
      let productImage = '/images/default-shoe.jpg';
      if (product?.colors?.[0]?.images?.[0]?.url) {
        productImage = product.colors[0].images[0].url;
      }
      
      return {
        ...product,
        productImage
      };
    });
    
    console.log(`✅ Home page loaded - Products: ${enhancedProducts.length}`);
    
    res.render('index', {
      title: 'Royal Footwear - Premium Shoes Collection',
      user: req.user,
      featuredProducts: enhancedProducts,
      categoryImages: categoryImages,
      heroImage: heroImage,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
    
  } catch (error) {
    console.error('❌ Error loading home page:', error);
    res.status(500).render('index', {
      title: 'Royal Footwear',
      user: req.user,
      featuredProducts: [],
      categoryImages: {},
      heroImage: '/images/hero-shoe.png',
      error_msg: 'Error loading page'
    });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Login Page
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    req.flash('info_msg', 'You are already logged in');
    return res.redirect('/');
  }
  
  res.render('auth/login', {
    title: 'Login | Royal Footwear',
    errors: [],
    email: '',
    error_msg: req.flash('error_msg'),
    success_msg: req.flash('success_msg')
  });
});

// Register Page
app.get('/register', (req, res) => {
  if (req.isAuthenticated()) {
    req.flash('info_msg', 'You are already logged in');
    return res.redirect('/');
  }
  
  res.render('auth/register', {
    title: 'Create Account | Royal Footwear',
    errors: [],
    name: '',
    email: '',
    error_msg: req.flash('error_msg'),
    success_msg: req.flash('success_msg')
  });
});

// Register Handle
app.post('/register', async (req, res) => {
  console.log('📝 Registration attempt');
  console.log('Request body:', req.body);
  
  try {
    const { name, email, password, confirm_password } = req.body;
    
    let errors = [];

    // Validation
    if (!name || !email || !password || !confirm_password) {
      errors.push({ msg: 'Please fill in all fields' });
      console.log('❌ Missing fields');
    }

    if (password !== confirm_password) {
      errors.push({ msg: 'Passwords do not match' });
      console.log('❌ Passwords do not match');
    }

    if (password.length < 6) {
      errors.push({ msg: 'Password must be at least 6 characters long' });
      console.log('❌ Password too short');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push({ msg: 'Please enter a valid email address' });
      console.log('❌ Invalid email format');
    }

    // If there are errors, render again with errors
    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return res.render('auth/register', {
        title: 'Create Account | Royal Footwear',
        errors,
        name,
        email
      });
    }

    // Check if user already exists
    console.log('🔍 Checking if user exists:', email.toLowerCase());
    const userExists = await User.findOne({ email: email.toLowerCase() });
    
    if (userExists) {
      console.log('❌ User already exists:', email);
      errors.push({ msg: 'Email is already registered' });
      return res.render('auth/register', {
        title: 'Create Account | Royal Footwear',
        errors,
        name,
        email
      });
    }

    console.log('👤 Creating new user...');
    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: 'customer'
    });

    console.log('💾 Saving user to database...');
    await newUser.save();
    console.log(`✅ User registered: ${newUser.email}`);
    console.log('User ID:', newUser._id);
    console.log('Password field exists:', !!newUser.password);

    // Auto login after registration
    console.log('🔐 Attempting auto-login...');
    req.login(newUser, (err) => {
      if (err) {
        console.error('❌ Auto login error:', err);
        req.flash('success_msg', '🎉 Registration successful! Please login.');
        return res.redirect('/login');
      }
      
      console.log('✅ Auto-login successful');
      req.flash('success_msg', `🎉 Welcome ${newUser.name}! Registration successful.`);
      return res.redirect('/');
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    let errorMessage = 'Registration failed. Please try again.';
    
    // Handle specific errors
    if (error.code === 11000) {
      errorMessage = 'Email is already registered';
    } else if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
    }
    
    req.flash('error_msg', errorMessage);
    res.redirect('/register');
  }
});

// Login Handle
app.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next);
});

// Logout Handle
app.get('/logout', (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'You are not logged in!');
    return res.redirect('/login');
  }
  
  const userName = req.user ? req.user.name : 'User';
  const userEmail = req.user ? req.user.email : '';
  
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    
    console.log(`👋 User logged out: ${userEmail}`);
    req.flash('success_msg', `Goodbye, ${userName}! You have been logged out successfully.`);
    res.redirect('/login');
  });
});

// Profile Page (Protected)
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please login to view your profile');
    return res.redirect('/login');
  }
  
  res.render('auth/profile', {
    title: 'My Profile | Royal Footwear',
    user: req.user,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg'),
    orders: [] // You can add actual orders from database
  });
});

// Update Profile
app.post('/profile/update', async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please login to update your profile');
    return res.redirect('/login');
  }
  
  try {
    const { name, phone, avatar, newsletter } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      name,
      'address.phone': phone,
      avatar: avatar || req.user.avatar,
      newsletterSubscription: newsletter === 'on'
    });
    
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', 'Failed to update profile');
    res.redirect('/profile');
  }
});

// Update Address
app.post('/profile/update-address', async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please login to update address');
    return res.redirect('/login');
  }
  
  try {
    const { street, city, state, country, zipCode } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      'address.street': street,
      'address.city': city,
      'address.state': state,
      'address.country': country,
      'address.zipCode': zipCode
    });
    
    req.flash('success_msg', 'Address updated successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Address update error:', error);
    req.flash('error_msg', 'Failed to update address');
    res.redirect('/profile');
  }
});

// Change Password
app.post('/profile/change-password', async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please login to change password');
    return res.redirect('/login');
  }
  
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    const errors = [];
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      errors.push('Please fill in all fields');
    }
    
    if (newPassword !== confirmPassword) {
      errors.push('New passwords do not match');
    }
    
    if (newPassword.length < 6) {
      errors.push('New password must be at least 6 characters');
    }
    
    if (errors.length > 0) {
      req.flash('error_msg', errors[0]);
      return res.redirect('/profile');
    }
    
    // Get fresh user data
    const user = await User.findById(req.user._id);
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/profile');
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error_msg', 'Failed to change password');
    res.redirect('/profile');
  }
})

// ==================== OTHER ROUTES ====================



// Other routes
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/orders', require('./routes/orders'));

// Contact page
app.get('/contact', (req, res) => {
  res.render('contact', { 
    title: 'Contact Us | Royal Footwear',
    user: req.user
  });
});


app.get('/faq', (req, res) => {
    res.render('faq', { 
        title: 'FAQ | Royal Footwear',
        user: req.user || null 
    });
});

// About page
// app.js mein ya routes/index.js mein
app.get('/about', (req, res) => {
    res.render('aboutUs', {
        title: 'About Us | Royal Footwear',
        user: req.user || null
    });
});

app.get('/privacy', (req, res) => {
    res.render('privacyPolicy', {
        title: 'Privacy Policy | Royal Footwear',
        user: req.user || null
    });
});

//error handler
app.all(/./, (req , res , next)=> {
  next(new ExpressError(404, "Page not found"));
})

//middleware
app.use((err , req ,res , next)=> {
  let {status=500 , message="Something went wrong!"} = err;
  res.status(status).render("error.ejs", {message});
})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Authentication system ready`);
});