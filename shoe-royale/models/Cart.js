const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
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
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    size: {
        type: Number,
        required: true
    },
    color: {
        name: String,
        code: String
    },
    image: {
        url: String,
        secure_url: String
    },
    brand: {
        type: String
    },
    category: {
        type: String
    }
}, {
    timestamps: true
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [cartItemSchema]
}, {
    timestamps: true
});

// Static method to add item to cart (SIMPLE VERSION)
// Static method to add item to cart with duplicate check
cartSchema.statics.addToCart = async function(userId, itemData) {
  try {
    let cart = await this.findOne({ user: userId });
    
    if (!cart) {
      cart = new this({
        user: userId,
        items: []
      });
    }
    
    // Check if item already exists with same size and color
    const existingItemIndex = cart.items.findIndex(item =>
      item.product.toString() === itemData.productId &&
      item.size === itemData.size &&
      item.color?.name === itemData.color
    );
    
    const quantityToAdd = parseInt(itemData.quantity) || 1;
    
    if (existingItemIndex > -1) {
      // Update quantity (this case should be handled by route now)
      cart.items[existingItemIndex].quantity += quantityToAdd;
    } else {
      // Add new item
      const newItem = {
        product: itemData.productId,
        name: itemData.name,
        price: itemData.price || 0,
        discountPrice: itemData.discountPrice,
        quantity: quantityToAdd,
        size: itemData.size,
        color: {
          name: itemData.color,
          code: itemData.colorCode || '#000000'
        },
        brand: itemData.brand,
        category: itemData.category
      };
      
      // Add image
      if (itemData.image && typeof itemData.image === 'object') {
        newItem.image = {
          url: itemData.image.url || '/images/default-shoe.jpg',
          secure_url: itemData.image.secure_url || itemData.image.url || '/images/default-shoe.jpg'
        };
      } else {
        newItem.image = {
          url: '/images/default-shoe.jpg',
          secure_url: '/images/default-shoe.jpg'
        };
      }
      
      cart.items.push(newItem);
    }
    
    await cart.save();
    return cart;
    
  } catch (error) {
    throw error;
  }
};
// Instance method to calculate totals
cartSchema.methods.calculateTotals = function() {
    try {
        const subtotal = this.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        
        const discountTotal = this.items.reduce((sum, item) => {
            if (item.discountPrice && item.discountPrice < item.price) {
                return sum + ((item.price - item.discountPrice) * item.quantity);
            }
            return sum;
        }, 0);
        
        const total = subtotal - discountTotal;
        const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
        
        return {
            subtotal,
            discountTotal,
            total,
            itemCount,
            productCount: this.items.length,
            savings: discountTotal
        };
    } catch (error) {
        console.error('Error calculating totals:', error);
        return {
            subtotal: 0,
            discountTotal: 0,
            total: 0,
            itemCount: 0,
            productCount: 0,
            savings: 0
        };
    }
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;