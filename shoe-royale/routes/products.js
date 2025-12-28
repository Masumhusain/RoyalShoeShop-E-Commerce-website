const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Product = require('../models/Product');

// Get all products
// Get all products
router.get('/', async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, sort } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
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
      case 'rating':
        sortOption = { rating: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const product = await Product.find(filter).sort(sortOption);
    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');

    res.render('products/index', {
      title: 'Products',
      product: product || [], // Ensure it's always an array
      categories: categories || [],
      brands: brands || [],
      filters: req.query || {}
    });
  } catch (err) {
    console.error(err);
    res.render('products/index', {
      title: 'Products',
      product: [],
      categories: [],
      brands: [],
      filters: {}
    });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).render('404', { title: 'Product Not Found' });
    }

    // Get related products
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }
    }).limit(4);

    res.render('products/show', {
      title: product.name,
      product,
      relatedProducts
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error loading product'
    });
  }
});

// Admin routes
router.get('/admin/create', ensureAdmin, (req, res) => {
  res.render('products/create', { title: 'Create Product' });
});

router.post('/admin/create', ensureAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price, discountPrice, category, brand, sizes, colors } = req.body;
    
    const sizeArray = sizes.split(',').map(size => ({
      size: parseInt(size.trim()),
      quantity: parseInt(req.body[`quantity_${size}`])
    }));

    const colorArray = colors.split(',').map((color, index) => ({
      name: color.trim(),
      code: req.body[`color_code_${index}`],
      images: req.files
        .filter(file => file.fieldname === `color_images_${index}`)
        .map(file => `/uploads/products/${file.filename}`)
    }));

    const product = new Product({
      name,
      description,
      price,
      discountPrice,
      category,
      brand,
      sizes: sizeArray,
      colors: colorArray
    });

    await product.save();
    
    req.flash('success_msg', 'Product created successfully');
    res.redirect('/products');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating product');
    res.redirect('/products/admin/create');
  }
});



router.get('/cart/count', async (req, res) => {
  try {
    let count = 0;
    if (req.user) {
      const Cart = require('../models/Cart');
      const cart = await Cart.findOne({ user: req.user._id });
      count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    }
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.json({ count: 0 });
  }
});

module.exports = router;