const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const upload = require('../middleware/uploadCloudinary');
const Product = require('../models/Product');

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

// Admin - Add Product Page
// GET: Show create product form
// GET: Show create product form
// GET: Show create product form
router.get('/products/create', (req, res) => {
  try {
    console.log('📄 GET /admin/products/create - Rendering form');
    
    // Admin authentication check
    if (!req.session.user || req.session.user.role !== 'admin') {
      req.flash('error_msg', 'Please login as admin first');
      return res.redirect('/admin-login');
    }
    
    // Data for the form
    const formData = {
      title: 'Add New Product',
      user: req.session.user,
      categories: ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal'],
      brands: ['Nike', 'Adidas', 'Puma', 'Reebok', 'Woodland', 'Bata', 'Campus', 'Red Tape', 'Sparx', 'Skechers', 'Crocs', 'Converse', 'Vans'],
      sizes: [6, 7, 8, 9, 10, 11, 12],
      colors: [
        { name: 'Black', code: '#000000' },
        { name: 'White', code: '#FFFFFF' },
        { name: 'Red', code: '#FF0000' },
        { name: 'Blue', code: '#0000FF' },
        { name: 'Green', code: '#008000' },
        { name: 'Brown', code: '#8B4513' },
        { name: 'Gray', code: '#808080' },
        { name: 'Navy Blue', code: '#000080' },
        { name: 'Maroon', code: '#800000' },
        { name: 'Orange', code: '#FFA500' },
        { name: 'Yellow', code: '#FFFF00' },
        { name: 'Pink', code: '#FFC0CB' },
        { name: 'Purple', code: '#800080' },
        { name: 'Beige', code: '#F5F5DC' },
        { name: 'Khaki', code: '#C3B091' }
      ],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    };
    
    console.log('✅ Form data prepared, rendering page...'); // Fixed line
    res.render('admin/product-create', formData);
    
  } catch (error) {
    console.error('❌ Error rendering create page:', error);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/admin/products');
  }
});

// POST: Handle product creation
// DEBUG ROUTE - सिर्फ check के लिए
// routes/admin.js में POST route



// const upload = require('../middleware/uploadCloudinary');



// POST: Handle product creation
router.post('/products/create', upload.array('images', 10), async (req, res) => {
  try {
    console.log('🚀 POST /admin/products/create - Processing...');
    
    // Admin authentication check
    if (!req.session.user || req.session.user.role !== 'admin') {
      req.flash('error_msg', 'Please login as admin first');
      return res.redirect('/admin-login');
    }
    
    // Log request data for debugging
    console.log('📦 Request body keys:', Object.keys(req.body));
    console.log('📸 Files uploaded:', req.files ? req.files.length : 0);
    
    // 1. VALIDATION
    const { name, description, price, discountPrice, category, brand, featured } = req.body;
    
    const errors = [];
    if (!name || name.trim() === '') errors.push('Product name is required');
    if (!description || description.trim() === '') errors.push('Description is required');
    if (!price || isNaN(price) || parseFloat(price) <= 0) errors.push('Valid price is required');
    if (!category) errors.push('Category is required');
    if (!brand) errors.push('Brand is required');
    
    if (errors.length > 0) {
      req.flash('error_msg', errors.join(', '));
      return res.redirect('/admin/products/create');
    }
    
    // 2. CHECK IMAGES
    if (!req.files || req.files.length === 0) {
      req.flash('error_msg', 'Please upload at least one product image');
      return res.redirect('/admin/products/create');
    }
    
    console.log(`✅ Validation passed, ${req.files.length} image(s) uploaded`);
    
    // 3. PROCESS SIZES
    const sizes = [];
    
    // Get sizes from checkboxes
    if (req.body.sizes) {
      let sizesArray = req.body.sizes;
      // Convert to array if single value
      if (!Array.isArray(sizesArray)) {
        sizesArray = [sizesArray];
      }
      
      sizesArray.forEach(sizeStr => {
        const size = parseInt(sizeStr);
        const quantityKey = `size_${size}_quantity`;
        const quantity = parseInt(req.body[quantityKey]) || 0;
        
        if (quantity > 0) {
          sizes.push({
            size: size,
            quantity: quantity
          });
        }
      });
    }
    
    // If no sizes from checkboxes, check individual fields
    if (sizes.length === 0) {
      for (let size = 6; size <= 12; size++) {
        const quantityKey = `size_${size}_quantity`;
        if (req.body[quantityKey] && parseInt(req.body[quantityKey]) > 0) {
          sizes.push({
            size: size,
            quantity: parseInt(req.body[quantityKey])
          });
        }
      }
    }
    
    // Default size if none selected
    if (sizes.length === 0) {
      sizes.push({ size: 9, quantity: 10 });
    }
    
    console.log('👟 Processed sizes:', sizes);
    
    // 4. PROCESS COLORS
    const colors = [];
    
    if (req.body.colors) {
      let colorsArray = req.body.colors;
      // Convert to array if single value
      if (!Array.isArray(colorsArray)) {
        colorsArray = [colorsArray];
      }
      
      // Filter out empty values
      colorsArray = colorsArray.filter(color => color && color.trim() !== '');
      
      if (colorsArray.length > 0) {
        colorsArray.forEach(colorName => {
          const colorCodeKey = `color_${colorName}_code`;
          const colorCode = req.body[colorCodeKey] || '#000000';
          
          colors.push({
            name: colorName,
            code: colorCode,
            images: [] // Will be assigned below
          });
        });
      }
    }
    
    // 5. PROCESS IMAGES (Cloudinary)
    const cloudinaryImages = req.files.map(file => ({
      url: file.path,           // Cloudinary URL
      public_id: file.filename, // Cloudinary public ID
      secure_url: file.path     // HTTPS URL
    }));
    
    console.log('🖼️ Cloudinary images:', cloudinaryImages.length);
    
    // 6. ASSIGN IMAGES TO COLORS
    if (colors.length === 0) {
      // If no colors selected, create default color with all images
      colors.push({
        name: 'Default',
        code: '#000000',
        images: cloudinaryImages
      });
    } else {
      // Distribute images among selected colors
      const imagesPerColor = Math.ceil(cloudinaryImages.length / colors.length);
      
      colors.forEach((color, index) => {
        const startIdx = index * imagesPerColor;
        const endIdx = Math.min(startIdx + imagesPerColor, cloudinaryImages.length);
        color.images = cloudinaryImages.slice(startIdx, endIdx);
      });
    }
    
    console.log('🎨 Colors with images:', colors.map(c => ({ name: c.name, images: c.images.length })));
    
    // 7. CALCULATE TOTAL STOCK
    const totalStock = sizes.reduce((sum, size) => sum + size.quantity, 0);
    
    // 8. CREATE PRODUCT OBJECT
    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      category: category,
      brand: brand,
      sizes: sizes,
      colors: colors,
      featured: featured === 'on',
      rating: 0,
      reviewsCount: 0,
      createdAt: new Date()
    };
    
    console.log('💾 Product data ready for save');
    
    // 9. SAVE TO DATABASE
    const Product = mongoose.model('Product');
    const product = new Product(productData);
    
    const savedProduct = await product.save();
    
    console.log('✅ Product saved successfully! ID:', savedProduct._id);
    console.log('Total images saved:', savedProduct.colors.reduce((sum, color) => sum + color.images.length, 0));
    
    // 10. SUCCESS RESPONSE
    req.flash('success_msg', `Product "${savedProduct.name}" added successfully with ${req.files.length} images!`);
    res.redirect('/products');
    
  } catch (error) {
    console.error('❌ ERROR in product creation:', error);
    console.error('Error details:', error.message);
    
    // Cleanup: Delete uploaded files from Cloudinary on error
    if (req.files && req.files.length > 0) {
      console.log('🧹 Cleaning up uploaded images due to error');
      const cloudinary = require('../config/cloudinary');
      req.files.forEach(file => {
        cloudinary.uploader.destroy(file.filename, (err, result) => {
          if (err) console.error('Failed to delete from Cloudinary:', err);
        });
      });
    }
    
    // Redirect back with error message
    req.flash('error_msg', `Error creating product: ${error.message}`);
    res.redirect('/admin/products/create');
  }
});
// Admin - Edit Product Page
router.get('/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    res.render('/product-edit', {
      title: 'Edit Product | Admin',
      user: req.user,
      product,
      categories: ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal'],
      brands: ['Nike', 'Adidas', 'Puma', 'Reebok', 'Woodland', 'Bata', 'Campus', 'Red Tape', 'Sparx', 'Skechers', 'Crocs', 'Converse', 'Vans'],
      sizes: [6, 7, 8, 9, 10, 11, 12],
      colors: [
        { name: 'Black', code: '#000000' },
        { name: 'White', code: '#FFFFFF' },
        { name: 'Red', code: '#FF0000' },
        { name: 'Blue', code: '#0000FF' },
        { name: 'Green', code: '#008000' },
        { name: 'Brown', code: '#8B4513' },
        { name: 'Gray', code: '#808080' },
        { name: 'Navy Blue', code: '#000080' },
        { name: 'Maroon', code: '#800000' },
        { name: 'Orange', code: '#FFA500' },
        { name: 'Yellow', code: '#FFFF00' },
        { name: 'Pink', code: '#FFC0CB' },
        { name: 'Purple', code: '#800080' },
        { name: 'Beige', code: '#F5F5DC' },
        { name: 'Khaki', code: '#C3B091' }
      ],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
    
  } catch (error) {
    console.error('Error loading product for edit:', error);
    req.flash('error_msg', 'Error loading product');
    res.redirect('/admin/products');
  }
});

// Admin - Handle Edit Product
router.post('/edit/:id', ensureAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    // Update product fields
    product.name = req.body.name;
    product.description = req.body.description;
    product.price = parseFloat(req.body.price);
    product.discountPrice = req.body.discountPrice ? parseFloat(req.body.discountPrice) : undefined;
    product.category = req.body.category;
    product.brand = req.body.brand;
    product.featured = req.body.featured === 'on';

    // Update sizes
    if (req.body.sizes && Array.isArray(req.body.sizes)) {
      product.sizes = req.body.sizes.map(size => ({
        size: parseInt(size),
        quantity: parseInt(req.body[`size_${size}_quantity`] || 0)
      }));
    }

    // Update colors
    if (req.body.colors && Array.isArray(req.body.colors)) {
      product.colors = req.body.colors.map(color => ({
        name: color,
        code: req.body[`color_${color}_code`] || '#000000'
      }));
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
      
      // Add new images to existing images
      if (product.colors.length === 0) {
        // Create default color if none exists
        product.colors.push({
          name: 'Default',
          code: '#000000',
          images: newImages
        });
      } else {
        // Add to first color's images
        product.colors[0].images = [...(product.colors[0].images || []), ...newImages];
      }
    }

    await product.save();

    req.flash('success_msg', 'Product updated successfully!');
    res.redirect('/admin/products');
    
  } catch (error) {
    console.error('Error updating product:', error);
    req.flash('error_msg', `Error updating product: ${error.message}`);
    res.redirect(`/products/admin/edit/${req.params.id}`);
  }
});

// Admin - Delete Product
router.post('/delete/:id', ensureAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Product deleted successfully!');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error deleting product:', error);
    req.flash('error_msg', 'Error deleting product');
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