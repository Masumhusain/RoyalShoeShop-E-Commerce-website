module.exports = {
    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Please log in to view this resource');
        res.redirect('/login');
    },

    ensureAdmin: (req, res, next) => {
        if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'moderator')) {
            return next();
        }
        req.flash('error_msg', 'Admin access required');
        
        // Redirect to admin login if trying to access admin routes
        if (req.originalUrl.startsWith('/admin')) {
            return res.redirect('/admin/login');
        }
        
        res.redirect('/');
    },

    forwardAuthenticated: (req, res, next) => {
        if (!req.isAuthenticated()) {
            return next();
        }
        
        // If user is admin and trying to access login, redirect to admin dashboard
        if (req.user.role === 'admin' || req.user.role === 'moderator') {
            if (req.originalUrl.includes('/login')) {
                return res.redirect('/admin/dashboard');
            }
        }
        
        res.redirect('/');
    }
};