const mongoose = require('mongoose');
require('dotenv').config();

async function initDatabase() {
  try {
    // Connect to MongoDB without database name first
    await mongoose.connect('mongodb://localhost:27017/', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB server');
    
    // Create database if not exists
    const db = mongoose.connection.useDb('shoe_royale');
    
    // Create collections by defining models
    const Product = mongoose.model('Product', new mongoose.Schema({
      name: String,
      price: Number
    }), 'products');
    
    // Create at least one product to avoid errors
    const existingProduct = await Product.findOne();
    if (!existingProduct) {
      await Product.create({
        name: "Sample Shoe",
        price: 99.99,
        featured: true
      });
      console.log('Created sample product');
    }
    
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error.message);
    
    // Try alternative approach
    try {
      // Simple connection
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shoe_royale');
      console.log('Connected to MongoDB');
      
      // Create simple schema
      const ProductSchema = new mongoose.Schema({
        name: String,
        price: Number,
        featured: Boolean
      });
      
      const Product = mongoose.model('Product', ProductSchema);
      
      // Create sample product
      await Product.create({
        name: "Test Shoe",
        price: 49.99,
        featured: true
      });
      
      console.log('Created test product');
      process.exit(0);
    } catch (err2) {
      console.error('Alternative approach failed:', err2.message);
      process.exit(1);
    }
  }
}

initDatabase();