const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
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
    image: {
        url: String,
        public_id: String,
        secure_url: String
    },
    brand: {
        type: String
    },
    category: {
        type: String,
        enum: ['sneakers', 'boots', 'sandals', 'loafers', 'sports', 'formal']
    },
    colors: [{
        name: String,
        code: String,
        images: [{
            url: String,
            public_id: String,
            secure_url: String
        }]
    }],
    sizes: [{
        size: Number,
        quantity: Number
    }],
    addedAt: {
        type: Date,
        default: Date.now
    }
});

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [wishlistItemSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for faster queries
wishlistSchema.index({ user: 1 });

// Virtual for item count
wishlistSchema.virtual('itemCount').get(function() {
    return this.items.length;
});

// Static method to add to wishlist
wishlistSchema.statics.addToWishlist = async function(userId, productData) {
    try {
        let wishlist = await this.findOne({ user: userId });
        
        if (!wishlist) {
            wishlist = new this({
                user: userId,
                items: []
            });
        }
        
        // Check if product already exists
        const exists = wishlist.items.some(
            item => item.product.toString() === productData.productId
        );
        
        if (exists) {
            throw new Error('Product already in wishlist');
        }
        
        // Add product to wishlist
        wishlist.items.push({
            product: productData.productId,
            name: productData.name,
            price: productData.price,
            discountPrice: productData.discountPrice,
            image: productData.image || {
                url: '/images/default-shoe.jpg',
                secure_url: '/images/default-shoe.jpg'
            },
            brand: productData.brand,
            category: productData.category,
            colors: productData.colors || [],
            sizes: productData.sizes || []
        });
        
        await wishlist.save();
        return wishlist;
        
    } catch (error) {
        throw error;
    }
};

// Static method to remove from wishlist
wishlistSchema.statics.removeFromWishlist = async function(userId, productId) {
    try {
        const wishlist = await this.findOne({ user: userId });
        
        if (!wishlist) {
            throw new Error('Wishlist not found');
        }
        
        const initialLength = wishlist.items.length;
        wishlist.items = wishlist.items.filter(
            item => item.product.toString() !== productId
        );
        
        if (wishlist.items.length === initialLength) {
            throw new Error('Product not found in wishlist');
        }
        
        await wishlist.save();
        return wishlist;
        
    } catch (error) {
        throw error;
    }
};

// Static method to move item from wishlist to cart
wishlistSchema.statics.moveToCart = async function(userId, productId, size, color, quantity = 1) {
    try {
        const wishlist = await this.findOne({ user: userId });
        
        if (!wishlist) {
            throw new Error('Wishlist not found');
        }
        
        const itemIndex = wishlist.items.findIndex(
            item => item.product.toString() === productId
        );
        
        if (itemIndex === -1) {
            throw new Error('Product not found in wishlist');
        }
        
        const product = wishlist.items[itemIndex];
        
        // Remove from wishlist
        wishlist.items.splice(itemIndex, 1);
        await wishlist.save();
        
        // Return product data for cart
        return {
            productId: product.product,
            name: product.name,
            price: product.price,
            discountPrice: product.discountPrice,
            image: product.image,
            brand: product.brand,
            category: product.category,
            size: size,
            color: color,
            quantity: quantity
        };
        
    } catch (error) {
        throw error;
    }
};

// Instance method to check if product is in wishlist
wishlistSchema.methods.containsProduct = function(productId) {
    return this.items.some(
        item => item.product.toString() === productId
    );
};

// Instance method to get wishlist summary
wishlistSchema.methods.getSummary = function() {
    const totalValue = this.items.reduce((sum, item) => {
        const price = item.discountPrice || item.price;
        return sum + price;
    }, 0);
    
    const totalDiscount = this.items.reduce((sum, item) => {
        if (item.discountPrice && item.discountPrice < item.price) {
            return sum + (item.price - item.discountPrice);
        }
        return sum;
    }, 0);
    
    return {
        itemCount: this.items.length,
        totalValue: totalValue,
        totalDiscount: totalDiscount,
        categories: [...new Set(this.items.map(item => item.category))]
    };
};

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;