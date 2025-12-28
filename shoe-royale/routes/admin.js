const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Simple Admin Dashboard with Stats
router.get('/dashboard', async (req, res) => {
    // Check session for admin
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        // Get all required models
        const Product = mongoose.model('Product');
        const Order = mongoose.model('Order');
        const User = mongoose.model('User');
        
        // Calculate statistics
        const stats = await getDashboardStats();
        
        // Get flash messages from session
        const success_msg = req.session.success_msg;
        const error_msg = req.session.error_msg;
        
        // Clear flash messages after displaying
        delete req.session.success_msg;
        delete req.session.error_msg;
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user,
            currentPage: 'dashboard',
            stats: stats,
            success_msg: success_msg || '',
            error_msg: error_msg || ''
        });
        
    } catch (error) {
        console.error("Error loading admin dashboard:", error);
        
        // On error, show basic dashboard without stats
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user,
            currentPage: 'dashboard',
            stats: null,
            error_msg: 'Error loading statistics: ' + error.message
        });
    }
});

// Function to get dashboard statistics
async function getDashboardStats() {
    try {
        const Product = mongoose.model('Product');
        const Order = mongoose.model('Order');
        const User = mongoose.model('User');
        
        // Parallel database calls for better performance
        const [
            totalProducts,
            totalOrders,
            totalUsers,
            pendingOrders,
            lowStockProducts,
            todaysOrders,
            recentOrders,
            newUsers
        ] = await Promise.all([
            // Total products count
            Product.countDocuments(),
            
            // Total orders count
            Order.countDocuments(),
            
            // Total users count
            User.countDocuments(),
            
            // Pending orders (check different possible status names)
            Order.countDocuments({
                $or: [
                    { status: 'pending' },
                    { orderStatus: 'pending' },
                    { status: 'Pending' }
                ]
            }),
            
            // Low stock products (stock < 10)
            Product.countDocuments({ 
                $or: [
                    { stock: { $lt: 10, $gt: 0 } },
                    { quantity: { $lt: 10, $gt: 0 } }
                ]
            }),
            
            // Today's orders
            (async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return await Order.countDocuments({
                    createdAt: { $gte: today }
                });
            })(),
            
            // Recent orders (last 5)
            Order.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            
            // New users today
            (async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return await User.countDocuments({
                    createdAt: { $gte: today }
                });
            })()
        ]);
        
        // Calculate total revenue
        let totalRevenue = 0;
        try {
            const revenueResult = await Order.aggregate([
                { $match: { 
                    $or: [
                        { status: 'completed' },
                        { status: 'delivered' },
                        { paymentStatus: 'completed' }
                    ]
                }},
                { $group: { 
                    _id: null, 
                    total: { $sum: '$totalAmount' } 
                }}
            ]);
            
            if (revenueResult.length > 0) {
                totalRevenue = revenueResult[0].total || 0;
            }
        } catch (error) {
            console.log("Revenue calculation skipped:", error.message);
        }
        
        // Calculate average order value
        let avgOrderValue = 0;
        if (totalOrders > 0 && totalRevenue > 0) {
            avgOrderValue = Math.round(totalRevenue / totalOrders);
        }
        
        // Prepare recent activities
        const recentActivities = [];
        
        // Add order activities
        recentOrders.forEach(order => {
            recentActivities.push({
                title: 'New Order',
                description: `Order #${order.orderId || order._id.toString().slice(-6)} placed`,
                time: formatTimeAgo(order.createdAt)
            });
        });
        
        // Add default welcome activity
        if (recentActivities.length === 0) {
            recentActivities.push({
                title: 'Welcome to Admin Panel',
                description: 'Start managing your store to see activities here',
                time: 'Just now'
            });
        }
        
        // Calculate percentage changes (demo for now - you can implement real calculations)
        const productChange = 12; // Example
        const orderChange = totalOrders > 100 ? 8 : 15;
        const userChange = newUsers > 0 ? Math.round((newUsers / totalUsers) * 100) : 5;
        const revenueChange = 18; // Example
        
        return {
            // Products
            totalProducts,
            lowStockItems: lowStockProducts,
            
            // Orders
            totalOrders,
            todaysOrders,
            pendingOrders,
            
            // Revenue
            totalRevenue,
            avgOrderValue,
            
            // Users
            totalUsers,
            newUsersToday: newUsers,
            
            // Changes
            productChange,
            orderChange,
            userChange,
            revenueChange,
            
            // Activities
            recentActivities
        };
        
    } catch (error) {
        console.error("Error in getDashboardStats:", error);
        throw error;
    }
}

// Helper function to format time
function formatTimeAgo(date) {
    if (!date) return 'Recently';
    
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return then.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Admin Products with Real Data
router.get('/products', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const Product = mongoose.model('Product');
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        
        res.render('admin/products', {
            title: 'Product Management',
            user: req.session.user,
            currentPage: 'products',
            products: products,
            success_msg: req.session.success_msg || '',
            error_msg: req.session.error_msg || ''
        });
        
        // Clear flash messages
        delete req.session.success_msg;
        delete req.session.error_msg;
        
    } catch (error) {
        console.error("Error loading products:", error);
        res.render('admin/products', {
            title: 'Product Management',
            user: req.session.user,
            currentPage: 'products',
            products: [],
            error_msg: 'Error loading products: ' + error.message
        });
    }
});

// Admin Orders with Real Data
router.get('/orders', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const Order = mongoose.model('Order');
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('user', 'name email')
            .lean();
        
        res.render('admin/orders', {
            title: 'Order Management',
            user: req.session.user,
            currentPage: 'orders',
            orders: orders,
            success_msg: req.session.success_msg || '',
            error_msg: req.session.error_msg || ''
        });
        
        // Clear flash messages
        delete req.session.success_msg;
        delete req.session.error_msg;
        
    } catch (error) {
        console.error("Error loading orders:", error);
        res.render('admin/orders', {
            title: 'Order Management',
            user: req.session.user,
            currentPage: 'orders',
            orders: [],
            error_msg: 'Error loading orders: ' + error.message
        });
    }
});

// Admin Users with Real Data
router.get('/users', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const User = mongoose.model('User');
        const users = await User.find()
            .sort({ createdAt: -1 })
            .select('-password')
            .lean();
        
        res.render('admin/users', {
            title: 'User Management',
            user: req.session.user,
            currentPage: 'users',
            users: users,
            success_msg: req.session.success_msg || '',
            error_msg: req.session.error_msg || ''
        });
        
        // Clear flash messages
        delete req.session.success_msg;
        delete req.session.error_msg;
        
    } catch (error) {
        console.error("Error loading users:", error);
        res.render('admin/users', {
            title: 'User Management',
            user: req.session.user,
            currentPage: 'users',
            users: [],
            error_msg: 'Error loading users: ' + error.message
        });
    }
});

// Admin Settings
router.get('/settings', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    res.render('admin/settings', {
        title: 'Admin Settings',
        user: req.session.user,
        currentPage: 'settings'
    });
});

// Additional Admin Routes for Better Management

// Create Product Page
router.get('/products/create', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    res.render('admin/product-create', {
        title: 'Add New Product',
        user: req.session.user,
        currentPage: 'products'
    });
});

// Edit Product Page
router.get('/products/edit/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const Product = mongoose.model('Product');
        const product = await Product.findById(req.params.id).lean();
        
        if (!product) {
            req.session.error_msg = 'Product not found';
            return res.redirect('/admin/products');
        }
        
        res.render('admin/product-edit', {
            title: 'Edit Product',
            user: req.session.user,
            currentPage: 'products',
            product: product
        });
        
    } catch (error) {
        console.error("Error loading product for edit:", error);
        req.session.error_msg = 'Error loading product';
        res.redirect('/admin/products');
    }
});

// View Order Details
router.get('/orders/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const Order = mongoose.model('Order');
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .lean();
        
        if (!order) {
            req.session.error_msg = 'Order not found';
            return res.redirect('/admin/orders');
        }
        
        res.render('admin/order-details', {
            title: 'Order Details',
            user: req.session.user,
            currentPage: 'orders',
            order: order
        });
        
    } catch (error) {
        console.error("Error loading order details:", error);
        req.session.error_msg = 'Error loading order details';
        res.redirect('/admin/orders');
    }
});

// View User Details
router.get('/users/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin-login');
    }
    
    try {
        const User = mongoose.model('User');
        const user = await User.findById(req.params.id)
            .select('-password')
            .lean();
        
        if (!user) {
            req.session.error_msg = 'User not found';
            return res.redirect('/admin/users');
        }
        
        // Get user's orders
        const Order = mongoose.model('Order');
        const userOrders = await Order.find({ user: req.params.id })
            .sort({ createdAt: -1 })
            .lean();
        
        res.render('admin/user-details', {
            title: 'User Details',
            user: req.session.user,
            currentPage: 'users',
            userData: user,
            orders: userOrders
        });
        
    } catch (error) {
        console.error("Error loading user details:", error);
        req.session.error_msg = 'Error loading user details';
        res.redirect('/admin/users');
    }
});

// Dashboard Stats API (for AJAX refresh)
router.get('/api/stats', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const stats = await getDashboardStats();
        res.json({
            success: true,
            stats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error in stats API:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;