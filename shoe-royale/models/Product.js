const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    enum: ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal'],
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  sizes: [{
    size: Number,
    quantity: {
      type: Number,
      default: 0
    }
  }],
  colors: [{
    name: String,
    code: String,
    images: [{
      url: String,        // Cloudinary URL
      public_id: String,  // Cloudinary public_id for deletion
      secure_url: String  // HTTPS URL
    }]
  }],
  featured: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);