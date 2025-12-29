const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Product = require('./models/Product');
const User = require('./models/User');


// Import routes
const adminRoutes = require('./routes/admin');

// Import configurations
const connectDB = require('./config/database');
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
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
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
  next();
});


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

// Other routes

app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/orders', require('./routes/orders'));
app.use('/', require('./routes/auth'));

// Home route - Fixed
app.get('/', async (req, res) => {
  try {
    let featuredProducts = [];
    let categories = [];
    
    if (Product) {
      try {
        featuredProducts = await Product.find({ featured: true })
          .limit(8)
          .sort({ createdAt: -1 });
        
        categories = await Product.distinct('category');
      } catch (dbError) {
        console.log('Database might be empty or Product model not defined');
      }
    }
    
    if (!categories || categories.length === 0) {
      categories = ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal'];
    }
    
    res.render('index', { 
      title: 'Royal Footwear - Premium Shoes',
      featuredProducts: featuredProducts || [],
      categories: categories || [],
      user: req.user || null
    });
  } catch (error) {
    console.error('Error loading home page:', error);
    res.render('index', { 
      title: 'Royal Footwear - Premium Shoes',
      featuredProducts: [],
      categories: ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal'],
      user: req.user || null
    });
  }
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found | Royal Footwear',
        user: req.user || null
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});