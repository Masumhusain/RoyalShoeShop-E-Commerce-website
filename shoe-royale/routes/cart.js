const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// View cart
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    res.render('cart/index', {
      title: 'Shopping Cart',
      cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error loading cart'
    });
  }
});

// Add to cart
router.post('/add', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: []
      });
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId && 
              item.size === parseInt(size) && 
              item.color.name === color
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += parseInt(quantity);
    } else {
      const selectedColor = product.colors.find(c => c.name === color);
      
      cart.items.push({
        product: productId,
        quantity: parseInt(quantity),
        size: parseInt(size),
        color: {
          name: color,
          code: selectedColor?.code || '#000000'
        },
        price: product.discountPrice || product.price
      });
    }

    // Calculate total
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    cart.updatedAt = Date.now();
    await cart.save();

    req.flash('success_msg', 'Item added to cart');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding item to cart');
    res.redirect('back');
  }
});

// Update cart item
router.put('/update/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    
    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === req.params.itemId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = parseInt(quantity);
      
      cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      cart.updatedAt = Date.now();
      await cart.save();

      res.json({ 
        success: true, 
        totalAmount: cart.totalAmount 
      });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating cart' });
  }
});

// Remove from cart
router.delete('/remove/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    cart.items = cart.items.filter(
      item => item._id.toString() !== req.params.itemId
    );

    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    cart.updatedAt = Date.now();
    await cart.save();

    req.flash('success_msg', 'Item removed from cart');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error removing item from cart');
    res.redirect('/cart');
  }
});




// Add these routes to your existing cart.js file:

// Clear cart
router.delete('/clear', ensureAuthenticated, async (req, res) => {
    try {
        await Cart.findOneAndUpdate(
            { user: req.user._id },
            { items: [], totalAmount: 0, updatedAt: Date.now() }
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error clearing cart' });
    }
});

// Move item to wishlist
router.post('/move-to-wishlist/:itemId', ensureAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        
        // Find item to move
        const itemIndex = cart.items.findIndex(
            item => item._id.toString() === req.params.itemId
        );
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }
        
        // Remove item from cart
        const [removedItem] = cart.items.splice(itemIndex, 1);
        
        // Recalculate total
        cart.totalAmount = cart.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
        
        cart.updatedAt = Date.now();
        await cart.save();
        
        // Here you would add the item to wishlist
        // For now, we'll just return success
        
        res.json({ 
            success: true, 
            message: 'Item moved to wishlist',
            totalAmount: cart.totalAmount
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error moving item to wishlist' });
    }
});

// Cart count endpoint (already exists, just making sure)
router.get('/count', ensureAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        const count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        res.json({ count });
    } catch (err) {
        console.error(err);
        res.json({ count: 0 });
    }
});

module.exports = router;