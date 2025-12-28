const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { forwardAuthenticated } = require('../middleware/auth');
const User = require('../models/User');

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('auth/login', { title: 'Login' });
});

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => {
  res.render('auth/register', { title: 'Register' });
});

// Register Handle
router.post('/register', async (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  
  let errors = [];

  if (!name || !email || !password || !confirm_password) {
    errors.push({ msg: 'Please fill in all fields' });
  }

  if (password !== confirm_password) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password.length < 6) {
    errors.push({ msg: 'Password should be at least 6 characters' });
  }

  if (errors.length > 0) {
    res.render('auth/register', {
      title: 'Register',
      errors,
      name,
      email
    });
  } else {
    try {
      const userExists = await User.findOne({ email });
      
      if (userExists) {
        errors.push({ msg: 'Email is already registered' });
        res.render('auth/register', {
          title: 'Register',
          errors,
          name,
          email
        });
      } else {
        const newUser = new User({
          name,
          email,
          password
        });

        await newUser.save();
        
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/login');
      }
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Registration failed');
      res.redirect('/register');
    }
  }
});

// Login Handle
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next);
});

// Google Auth
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Logout Handle
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
  });
});

module.exports = router;