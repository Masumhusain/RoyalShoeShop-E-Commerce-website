const express = require('express');
const router = express.Router();
const passport = require('passport');
const { forwardAuthenticated } = require('../middleware/auth');
const User = require('../models/User');

// Login Page
// router.get('/login', (req, res) => {
//   res.render('auth/login', { 
//     title: 'Login | Royal Footwear',
//     success_msg: req.flash('success_msg'),
//     error_msg: req.flash('error_msg'),
//     error: req.flash('error')
//   });
// });

// // Register Page
// router.get('/register', forwardAuthenticated, (req, res) => {
//   res.render('auth/register', { 
//     title: 'Create Account | Royal Footwear',
//     success_msg: req.flash('success_msg'),
//     error_msg: req.flash('error_msg')
//   });
// });

// // Register Handle
// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password, confirm_password, newsletter } = req.body;
    
//     let errors = [];

//     // Validation - आपके HTML के हिसाब से
//     if (!name || !email || !password || !confirm_password) {
//       errors.push({ msg: 'Please fill in all fields' });
//     }

//     if (password !== confirm_password) {
//       errors.push({ msg: 'Passwords do not match' });
//     }

//     if (password.length < 6) {
//       errors.push({ msg: 'Password must be at least 6 characters long' });
//     }

//     // Email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       errors.push({ msg: 'Please enter a valid email address' });
//     }

//     // If there are errors, render again with errors
//     if (errors.length > 0) {
//       return res.render('auth/register', {
//         title: 'Create Account | Royal Footwear',
//         errors,
//         name,
//         email,
//         success_msg: null,
//         error_msg: null
//       });
//     }

//     // Check if user already exists
//     const userExists = await User.findOne({ email: email.toLowerCase() });
    
//     if (userExists) {
//       errors.push({ msg: 'Email is already registered' });
//       return res.render('auth/register', {
//         title: 'Create Account | Royal Footwear',
//         errors,
//         name,
//         email,
//         success_msg: null,
//         error_msg: null
//       });
//     }

//     // Create new user
//     const newUser = new User({
//       name: name.trim(),
//       email: email.toLowerCase().trim(),
//       password,
//       newsletterSubscription: newsletter === 'on' || newsletter === true
//     });

//     await newUser.save();

//     req.flash('success_msg', '🎉 Registration successful! Please login to your account');
//     res.redirect('/login');

//   } catch (error) {
//     console.error('Registration error:', error);
//     req.flash('error_msg', 'Registration failed. Please try again.');
//     res.redirect('/register');
//   }
// });

// // Login Handle
// router.post('/login', (req, res, next) => {
//   // Custom validation before passport authenticate
//   const { email, password } = req.body;
//   let errors = [];

//   if (!email || !password) {
//     errors.push({ msg: 'Please fill in all fields' });
//   }

//   if (errors.length > 0) {
//     return res.render('auth/login', {
//       title: 'Login | Royal Footwear',
//       errors,
//       email,
//       success_msg: null,
//       error_msg: null
//     });
//   }

//   passport.authenticate('local', (err, user, info) => {
//     if (err) {
//       console.error('Login error:', err);
//       req.flash('error_msg', 'Something went wrong. Please try again.');
//       return res.redirect('/login');
//     }

//     if (!user) {
//       // Passport authentication failed
//       if (info && info.message) {
//         req.flash('error_msg', info.message);
//       } else {
//         req.flash('error_msg', 'Invalid email or password');
//       }
//       return res.redirect('/login');
//     }

//     // Login successful
//     req.logIn(user, (err) => {
//       if (err) {
//         console.error('Login error:', err);
//         req.flash('error_msg', 'Something went wrong. Please try again.');
//         return res.redirect('/login');
//       }

//       // Update last login time
//       User.findByIdAndUpdate(user._id, { lastLogin: Date.now() }, { new: true })
//         .then(() => {
//           // Redirect based on user role
//           if (user.role === 'admin') {
//             req.flash('success_msg', 'Welcome back, Admin!');
//             return res.redirect('/admin/dashboard');
//           } else {
//             req.flash('success_msg', `Welcome back, ${user.name}!`);
//             return res.redirect('/');
//           }
//         })
//         .catch(err => {
//           console.error('Update last login error:', err);
//           req.flash('success_msg', `Welcome back, ${user.name}!`);
//           return res.redirect('/');
//         });
//     });
//   })(req, res, next);
// });

// // Google OAuth Routes
// router.get('/auth/google',
//   passport.authenticate('google', { 
//     scope: ['profile', 'email'],
//     prompt: 'select_account' // Force account selection
//   })
// );

// router.get('/auth/google/callback',
//   passport.authenticate('google', { 
//     failureRedirect: '/login',
//     failureFlash: true 
//   }),
//   (req, res) => {
//     // Update last login for Google users
//     User.findByIdAndUpdate(req.user._id, { lastLogin: Date.now() })
//       .then(() => {
//         req.flash('success_msg', `Welcome${req.user.name ? ' ' + req.user.name : ''}!`);
        
//         // Redirect based on role
//         if (req.user.role === 'admin') {
//           res.redirect('/admin/dashboard');
//         } else {
//           res.redirect('/');
//         }
//       })
//       .catch(err => {
//         console.error('Update last login error:', err);
//         req.flash('success_msg', `Welcome${req.user.name ? ' ' + req.user.name : ''}!`);
//         res.redirect('/');
//       });
//   }
// );

// Logout Handle
// router.get('/logout', (req, res, next) => {
//   const userName = req.user ? req.user.name : 'User';
  
//   req.logout((err) => {
//     if (err) {
//       return next(err);
//     }
//     req.flash('success_msg', `Goodbye, ${userName}! You have been logged out successfully.`);
//     res.redirect('/login');
//   });
// });

// Forgot Password Page
// router.get('/forgot-password', forwardAuthenticated, (req, res) => {
//   res.render('auth/forgot-password', { 
//     title: 'Forgot Password | Royal Footwear',
//     success_msg: req.flash('success_msg'),
//     error_msg: req.flash('error_msg')
//   });
// });

// Reset Password Page
router.get('/reset-password/:token', forwardAuthenticated, (req, res) => {
  res.render('auth/reset-password', { 
    title: 'Reset Password | Royal Footwear',
    token: req.params.token,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});

module.exports = router;