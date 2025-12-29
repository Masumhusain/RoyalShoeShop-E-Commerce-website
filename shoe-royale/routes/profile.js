const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Profile page
router.get('/', ensureAuthenticated, (req, res) => {
  res.render('profile/index', {
    title: 'My Profile | Royal Footwear',
    user: req.user
  });
});

// Update profile
router.post('/update', ensureAuthenticated, async (req, res) => {
  try {
    const { name, phone, street, city, state, country, zipCode } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      name,
      'address.phone': phone,
      'address.street': street,
      'address.city': city,
      'address.state': state,
      'address.country': country,
      'address.zipCode': zipCode
    });
    
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', 'Failed to update profile');
    res.redirect('/profile');
  }
});

// Change password
router.post('/change-password', ensureAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    const errors = [];
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      errors.push({ msg: 'Please fill in all fields' });
    }
    
    if (newPassword !== confirmPassword) {
      errors.push({ msg: 'New passwords do not match' });
    }
    
    if (newPassword.length < 6) {
      errors.push({ msg: 'New password must be at least 6 characters' });
    }
    
    if (errors.length > 0) {
      req.flash('error_msg', errors[0].msg);
      return res.redirect('/profile');
    }
    
    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/profile');
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error_msg', 'Failed to change password');
    res.redirect('/profile');
  }
});

module.exports = router;