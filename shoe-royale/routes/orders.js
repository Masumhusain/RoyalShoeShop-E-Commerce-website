const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

// Create order
router.post('/create', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      size: item.size,
      color: item.color.name,
      price: item.price,
      image: item.product.colors[0]?.images[0] || '/images/default-shoe.jpg'
    }));

    const totalAmount = cart.totalAmount;
    const taxAmount = totalAmount * 0.1; // 10% tax
    const shippingAmount = totalAmount > 100 ? 0 : 10; // Free shipping over $100
    const grandTotal = totalAmount + taxAmount + shippingAmount;

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress: req.user.address,
      paymentMethod: req.body.paymentMethod,
      totalAmount,
      taxAmount,
      shippingAmount,
      grandTotal,
      notes: req.body.notes
    });

    await order.save();
    
    // Clear cart after order
    cart.items = [];
    cart.totalAmount = 0;
    cart.updatedAt = Date.now();
    await cart.save();

    req.flash('success_msg', 'Order placed successfully!');
    res.redirect(`/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating order');
    res.redirect('/cart');
  }
});

// View order
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    
    if (!order) {
      return res.status(404).render('404', { title: 'Order Not Found' });
    }

    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      req.flash('error_msg', 'Access denied');
      return res.redirect('/');
    }

    res.render('orders/show', {
      title: 'Order Details',
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error loading order'
    });
  }
});

// User orders
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.render('orders/index', {
      title: 'My Orders',
      orders
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error loading orders'
    });
  }
});

module.exports = router;