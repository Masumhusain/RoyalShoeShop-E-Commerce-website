const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const mongoose = require('mongoose');

// Get all products
router.get('/', async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, sort, search } = req.query;
    let filter = {};

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Calculate discount filter
    if (req.query.discount === 'true') {
      filter.discountPrice = { $exists: true, $gt: 0 };
    }

    // Featured filter
    if (req.query.featured === 'true') {
      filter.featured = true;
    }

    let sortOption = {};
    switch (sort) {
      case 'price-low':
        sortOption = { price: 1 };
        break;
      case 'price-high':
        sortOption = { price: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'rating':
        sortOption = { rating: -1 };
        break;
      case 'name-asc':
        sortOption = { name: 1 };
        break;
      case 'name-desc':
        sortOption = { name: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const products = await Product.find(filter).sort(sortOption);
    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');

    // Calculate total products count
    const totalProducts = await Product.countDocuments(filter);

    res.render('products/index', {
      title: 'Products | Royal Footwear',
      products: products || [],
      categories: categories || [],
      brands: brands || [],
      filters: req.query || {},
      totalProducts,
      user: req.user || null
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.render('products/index', {
      title: 'Products | Royal Footwear',
      products: [],
      categories: [],
      brands: [],
      filters: {},
      totalProducts: 0,
      user: req.user || null
    });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).render('404', { 
        title: 'Product Not Found',
        user: req.user || null
      });
    }

    // Calculate total stock
    const totalStock = product.sizes.reduce((sum, size) => sum + size.quantity, 0);

    // Get related products (same category, different brand)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      brand: { $ne: product.brand }
    }).limit(4);

    // Get similar products (same brand)
    const similarProducts = await Product.find({
      brand: product.brand,
      _id: { $ne: product._id }
    }).limit(4);

    res.render('products/show', {
      title: `${product.name} | Royal Footwear`,
      product,
      totalStock,
      relatedProducts: relatedProducts || [],
      similarProducts: similarProducts || [],
      user: req.user || null,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error loading product:', err);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error loading product',
      user: req.user || null
    });
  }
});

// ============ CART ROUTES ============

// Add to Cart (Main Route - Called from Product Detail Page)
// Add to Cart Route - SIMPLE WORKING VERSION
// Add to Cart Route - with duplicate check
router.post('/cart/add', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    
    // Validation
    if (!productId || !size || !color) {
      return res.json({
        success: false,
        error: 'Please select size and color'
      });
    }

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find color object
    const selectedColor = product.colors.find(c => c.name === color);
    if (!selectedColor) {
      return res.json({
        success: false,
        error: 'Selected color not available'
      });
    }

    // Check if selected size is available
    const selectedSize = product.sizes.find(s => s.size == size);
    if (!selectedSize || selectedSize.quantity <= 0) {
      return res.json({
        success: false,
        error: 'Selected size is out of stock'
      });
    }

    // First check if product already in cart with same size and color
    let cart = await Cart.findOne({ user: req.user._id });
    
    if (cart) {
      // Check if item already exists
      const existingItem = cart.items.find(item =>
        item.product.toString() === productId &&
        item.size === parseInt(size) &&
        item.color?.name === color
      );
      
      if (existingItem) {
        return res.json({
          success: false,
          error: 'This item is already in your cart'
        });
      }
    }

    // Prepare item data
    const itemData = {
      productId: product._id,
      name: product.name,
      price: product.discountPrice || product.price,
      discountPrice: product.discountPrice,
      quantity: parseInt(quantity) || 1,
      size: parseInt(size),
      color: color,
      colorCode: selectedColor.code || '#000000',
      brand: product.brand,
      category: product.category
    };

    // Add image if available
    if (selectedColor.images && selectedColor.images.length > 0) {
      const firstImage = selectedColor.images[0];
      itemData.image = {
        url: firstImage.url || '/images/default-shoe.jpg',
        secure_url: firstImage.secure_url || firstImage.url || '/images/default-shoe.jpg'
      };
    }

    // Add to cart using Cart model method
    if (!cart) {
      cart = await Cart.addToCart(req.user._id, itemData);
    } else {
      // Use existing cart
      cart = await Cart.addToCart(req.user._id, itemData);
    }

    // Calculate totals
    const summary = cart.calculateTotals();
    
    res.json({
      success: true,
      message: 'Product added to cart successfully',
      cartCount: summary.itemCount,
      cartSummary: summary
    });
    
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding to cart. Please try again.'
    });
  }
});

// Check if item is already in cart
router.post('/cart/check-item', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, size, color } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id });
    
    let inCart = false;
    if (cart && cart.items) {
      inCart = cart.items.some(item =>
        item.product.toString() === productId &&
        item.size === size &&
        item.color?.name === color
      );
    }
    
    res.json({
      success: true,
      inCart: inCart
    });
    
  } catch (error) {
    console.error('Check cart item error:', error);
    res.json({
      success: false,
      inCart: false
    });
  }
});

// View Cart Page
router.get('/cart/view', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name brand category colors sizes');
    
    let subtotal = 0;
    if (cart && cart.items.length > 0) {
      subtotal = cart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);
    }

    res.render('cart/index', {
      title: 'Shopping Cart | Royal Footwear',
      cart: cart || { items: [] },
      subtotal: subtotal.toFixed(2),
      user: req.user
    });
    
  } catch (error) {
    console.error('Cart view error:', error);
    res.render('cart/index', {
      title: 'Shopping Cart | Royal Footwear',
      cart: { items: [] },
      subtotal: '0.00',
      user: req.user
    });
  }
});

// Get Cart Count (for Navbar)
router.get('/cart/count', async (req, res) => {
  try {
    let count = 0;
    if (req.user) {
      const cart = await Cart.findOne({ user: req.user._id });
      count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    }
    
    res.json({ 
      success: true, 
      count 
    });
    
  } catch (err) {
    console.error('Cart count error:', err);
    res.json({ 
      success: true, 
      count: 0 
    });
  }
});

// Update Cart Item Quantity
router.put('/cart/update/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { quantity } = req.body;
    const newQuantity = parseInt(quantity);
    
    if (!newQuantity || newQuantity < 1) {
      return res.json({ 
        success: false, 
        error: 'Invalid quantity' 
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.json({ 
        success: false, 
        error: 'Cart not found' 
      });
    }
    
    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === req.params.itemId
    );
    
    if (itemIndex === -1) {
      return res.json({ 
        success: false, 
        error: 'Item not found in cart' 
      });
    }
    
    // Update quantity
    cart.items[itemIndex].quantity = newQuantity;
    await cart.save();
    
    // Calculate new totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({
      success: true,
      subtotal: subtotal.toFixed(2),
      itemTotal: (cart.items[itemIndex].price * newQuantity).toFixed(2),
      cartCount: cartCount
    });
    
  } catch (error) {
    console.error('Update cart error:', error);
    res.json({ 
      success: false, 
      error: 'Error updating cart' 
    });
  }
});

// Remove Item from Cart
router.delete('/cart/remove/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.json({ 
        success: false, 
        error: 'Cart not found' 
      });
    }
    
    const initialLength = cart.items.length;
    
    cart.items = cart.items.filter(
      item => item._id.toString() !== req.params.itemId
    );
    
    if (cart.items.length === initialLength) {
      return res.json({ 
        success: false, 
        error: 'Item not found in cart' 
      });
    }
    
    await cart.save();
    
    // Calculate new totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({
      success: true,
      message: 'Item removed from cart',
      subtotal: subtotal.toFixed(2),
      cartCount: cartCount
    });
    
  } catch (error) {
    console.error('Remove cart error:', error);
    res.json({ 
      success: false, 
      error: 'Error removing item' 
    });
  }
});

// Clear Cart
router.delete('/cart/clear', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.json({ 
        success: false, 
        error: 'Cart not found' 
      });
    }
    
    cart.items = [];
    await cart.save();
    
    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cartCount: 0,
      subtotal: '0.00'
    });
    
  } catch (error) {
    console.error('Clear cart error:', error);
    res.json({ 
      success: false, 
      error: 'Error clearing cart' 
    });
  }
});

// ============ WISHLIST ROUTES ============
// Add to Wishlist - COMPLETE DATA VERSION
router.post('/wishlist/add', ensureAuthenticated, async (req, res) => {
  try {
    const { productId } = req.body;
    
    console.log('Adding product to wishlist:', productId);
    
    if (!productId) {
      return res.json({
        success: false,
        error: 'Product ID is required'
      });
    }

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.json({
        success: false,
        error: 'Product not found'
      });
    }

    console.log('Product found:', product.name);

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    
    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.user._id,
        items: []
      });
    }
    
    // Check if already in wishlist
    const exists = wishlist.items.some(
      item => item.product.toString() === productId
    );
    
    if (exists) {
      return res.json({
        success: false,
        error: 'Product already in wishlist'
      });
    }
    
    // Prepare complete wishlist item data
    const wishlistItem = {
      product: productId,
      name: product.name,
      price: product.price, // ORIGINAL PRICE
      discountPrice: product.discountPrice,
      brand: product.brand,
      category: product.category,
      colors: product.colors || [], // ADD COLORS
      sizes: product.sizes || [],   // ADD SIZES
      addedAt: new Date()
    };

    // Add image properly
    if (product.colors && product.colors.length > 0 && 
        product.colors[0].images && product.colors[0].images.length > 0) {
      const firstImage = product.colors[0].images[0];
      wishlistItem.image = {
        url: firstImage.url || '/images/default-shoe.jpg',
        public_id: firstImage.public_id || '',
        secure_url: firstImage.secure_url || firstImage.url || '/images/default-shoe.jpg'
      };
    } else if (product.images && product.images.length > 0) {
      // If product has direct images array
      const firstImage = product.images[0];
      wishlistItem.image = {
        url: firstImage.url || '/images/default-shoe.jpg',
        public_id: firstImage.public_id || '',
        secure_url: firstImage.secure_url || firstImage.url || '/images/default-shoe.jpg'
      };
    } else {
      wishlistItem.image = {
        url: '/images/default-shoe.jpg',
        secure_url: '/images/default-shoe.jpg'
      };
    }

    console.log('Wishlist item data:', {
      name: wishlistItem.name,
      price: wishlistItem.price,
      colorsCount: wishlistItem.colors.length,
      sizesCount: wishlistItem.sizes.length
    });

    // Add to wishlist
    wishlist.items.push(wishlistItem);
    await wishlist.save();

    console.log('Wishlist saved successfully');
    
    res.json({
      success: true,
      message: 'Added to wishlist successfully',
      wishlistCount: wishlist.items.length
    });
    
  } catch (error) {
    console.error('Wishlist add error:', error);
    res.json({
      success: false,
      error: 'Failed to add to wishlist: ' + error.message
    });
  }
});

// Remove from Wishlist
router.delete('/wishlist/remove/:productId', ensureAuthenticated, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    
    if (!wishlist) {
      return res.json({ 
        success: false, 
        error: 'Wishlist not found' 
      });
    }
    
    const initialLength = wishlist.items.length;
    
    wishlist.items = wishlist.items.filter(
      item => item.product.toString() !== req.params.productId
    );
    
    if (wishlist.items.length === initialLength) {
      return res.json({ 
        success: false, 
        error: 'Product not found in wishlist' 
      });
    }
    
    await wishlist.save();
    
    res.json({
      success: true,
      message: 'Removed from wishlist',
      wishlistCount: wishlist.items.length
    });
    
  } catch (error) {
    console.error('Remove wishlist error:', error);
    res.json({ 
      success: false, 
      error: 'Error removing from wishlist' 
    });
  }
});

// View Wishlist Page - UPDATED
router.get('/wishlist/view', ensureAuthenticated, async (req, res) => {
  try {
    // Get wishlist WITHOUT populate since we store all data
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    
    console.log('Wishlist retrieved:', {
      itemCount: wishlist ? wishlist.items.length : 0,
      hasData: wishlist && wishlist.items.length > 0 ? {
        firstItem: wishlist.items[0].name,
        hasColors: wishlist.items[0].colors && wishlist.items[0].colors.length > 0,
        hasSizes: wishlist.items[0].sizes && wishlist.items[0].sizes.length > 0
      } : 'No items'
    });
    
    res.render('wishlist/index', {
      title: 'My Wishlist | Royal Footwear',
      wishlist: wishlist || { items: [] },
      user: req.user
    });
    
  } catch (error) {
    console.error('Wishlist view error:', error);
    res.render('wishlist/index', {
      title: 'My Wishlist | Royal Footwear',
      wishlist: { items: [] },
      user: req.user
    });
  }
});

// Get Wishlist Count
router.get('/wishlist/count', ensureAuthenticated, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    const count = wishlist ? wishlist.items.length : 0;
    
    res.json({ 
      success: true, 
      count 
    });
    
  } catch (error) {
    console.error('Wishlist count error:', error);
    res.json({ 
      success: false, 
      count: 0 
    });
  }
});


// Clear Wishlist
router.delete('/wishlist/clear', ensureAuthenticated, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    
    if (!wishlist) {
      return res.json({ 
        success: false, 
        error: 'Wishlist not found' 
      });
    }
    
    wishlist.items = [];
    await wishlist.save();
    
    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      wishlistCount: 0
    });
    
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.json({ 
      success: false, 
      error: 'Error clearing wishlist' 
    });
  }
});
// ============ PRODUCT API ROUTES ============

// Quick View Product (AJAX)
router.get('/:id/quickview', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        images: product.colors[0]?.images || product.images || [],
        stock: product.sizes.reduce((sum, size) => sum + size.quantity, 0),
        sizes: product.sizes.filter(s => s.quantity > 0).map(s => s.size),
        colors: product.colors.map(c => ({ name: c.name, code: c.code })),
        brand: product.brand,
        category: product.category
      }
    });
  } catch (error) {
    console.error('Quick view error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading product'
    });
  }
});

// Get Products by Category
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ 
      category: req.params.category,
      'sizes.quantity': { $gt: 0 } // Only products with stock
    }).sort({ createdAt: -1 }).limit(20);

    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');

    res.render('products/category', {
      title: `${req.params.category.charAt(0).toUpperCase() + req.params.category.slice(1)} Shoes | Royal Footwear`,
      products: products || [],
      category: req.params.category,
      categories: categories || [],
      brands: brands || [],
      filters: req.query || {},
      user: req.user || null
    });
  } catch (error) {
    console.error('Category products error:', error);
    res.render('products/category', {
      title: 'Category | Royal Footwear',
      products: [],
      category: req.params.category,
      categories: [],
      brands: [],
      filters: {},
      user: req.user || null
    });
  }
});

// Search Products
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.redirect('/products');
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');

    res.render('products/search', {
      title: `Search: "${q}" | Royal Footwear`,
      products: products || [],
      searchQuery: q,
      categories: categories || [],
      brands: brands || [],
      user: req.user || null
    });
  } catch (error) {
    console.error('Search error:', error);
    res.render('products/search', {
      title: 'Search | Royal Footwear',
      products: [],
      searchQuery: req.query.q || '',
      categories: [],
      brands: [],
      user: req.user || null
    });
  }
});

// Featured Products (API)
router.get('/api/featured', async (req, res) => {
  try {
    const featuredProducts = await Product.find({ 
      featured: true,
      'sizes.quantity': { $gt: 0 }
    }).sort({ createdAt: -1 }).limit(8);

    res.json({
      success: true,
      products: featuredProducts
    });
  } catch (error) {
    console.error('Featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products'
    });
  }
});

// New Arrivals (API)
router.get('/api/new-arrivals', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newArrivals = await Product.find({
      createdAt: { $gte: thirtyDaysAgo },
      'sizes.quantity': { $gt: 0 }
    }).sort({ createdAt: -1 }).limit(8);

    res.json({
      success: true,
      products: newArrivals
    });
  } catch (error) {
    console.error('New arrivals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching new arrivals'
    });
  }
});

// Check Stock Availability
router.post('/check-stock', async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.json({
        success: false,
        available: false,
        message: 'Product not found'
      });
    }

    const selectedSize = product.sizes.find(s => s.size == size);
    const requestedQuantity = parseInt(quantity) || 1;
    
    if (!selectedSize) {
      return res.json({
        success: false,
        available: false,
        message: 'Selected size not available'
      });
    }

    const isAvailable = selectedSize.quantity >= requestedQuantity;
    
    res.json({
      success: true,
      available: isAvailable,
      maxQuantity: selectedSize.quantity,
      message: isAvailable ? 'In stock' : 'Out of stock'
    });
    
  } catch (error) {
    console.error('Stock check error:', error);
    res.json({
      success: false,
      available: false,
      message: 'Error checking stock'
    });
  }
});

// Get Available Sizes for Product
router.get('/:id/sizes', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const availableSizes = product.sizes
      .filter(size => size.quantity > 0)
      .map(size => ({
        size: size.size,
        quantity: size.quantity
      }));

    res.json({
      success: true,
      sizes: availableSizes
    });
    
  } catch (error) {
    console.error('Get sizes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sizes'
    });
  }
});

module.exports = router;