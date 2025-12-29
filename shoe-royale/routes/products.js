const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

const Product = require('../models/Product');
const Cart = require('../models/Cart');
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

// ============ ADMIN ROUTES ============


// ============ CART ROUTES ============

// Add to Cart
router.post('/:id/cart', ensureAuthenticated, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const { quantity = 1, size, color } = req.body;
    
    // Find or create cart for user
    let cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: []
      });
    }

    // Check if product already in cart with same size and color
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === product._id.toString() && 
              item.size === size && 
              item.color === color
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new item
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        discountedPrice: product.discountPrice,
        quantity: parseInt(quantity),
        size,
        color,
        image: product.colors[0]?.images?.[0] || product.images?.[0] || '/images/default-product.jpg'
      });
    }

    await cart.save();
    
    // Get updated cart with product details
    await cart.populate('items.product', 'name price images stock');

    res.json({
      success: true,
      message: 'Product added to cart',
      cart,
      cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    });
    
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to cart'
    });
  }
});

// Get Cart Count for Navbar
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

module.exports = router;