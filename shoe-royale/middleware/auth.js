// Check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/login');
};

// Check if user is NOT authenticated (for login/register pages)
const forwardAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  
  // Redirect based on user role
  if (req.user.role === 'admin') {
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/');
  }
};

// Check if user is admin
const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  
  req.flash('error_msg', 'You do not have permission to access this page');
  res.redirect('/');
};

// Check if user is customer
const ensureCustomer = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'customer') {
    return next();
  }
  
  req.flash('error_msg', 'Access denied');
  res.redirect('/');
};

module.exports = {
  ensureAuthenticated,
  forwardAuthenticated,
  ensureAdmin,
  ensureCustomer
};