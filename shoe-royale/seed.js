const mongoose = require('mongoose');
const Product = require('./models/Product');
const User = require('./models/User');
require('dotenv').config();

const sampleProducts = [
    {
        name: "Royal Executive Oxford",
        description: "Premium leather Oxford shoes perfect for formal occasions. Handcrafted with attention to detail.",
        price: 299.99,
        discountPrice: 249.99,
        category: "formal",
        brand: "Royal Heritage",
        sizes: [
            { size: 8, quantity: 15 },
            { size: 9, quantity: 20 },
            { size: 10, quantity: 18 },
            { size: 11, quantity: 12 }
        ],
        colors: [
            {
                name: "Black",
                code: "#000000",
                images: ["/images/products/oxford-black-1.jpg"]
            },
            {
                name: "Brown",
                code: "#8B4513",
                images: ["/images/products/oxford-brown-1.jpg"]
            }
        ],
        featured: true,
        rating: 4.8,
        reviewsCount: 42
    },
    {
        name: "Royal Athletic Pro",
        description: "High-performance sneakers with premium cushioning and breathable material.",
        price: 159.99,
        category: "sneakers",
        brand: "Royal Sport",
        sizes: [
            { size: 7, quantity: 25 },
            { size: 8, quantity: 30 },
            { size: 9, quantity: 35 },
            { size: 10, quantity: 28 },
            { size: 11, quantity: 20 }
        ],
        colors: [
            {
                name: "White",
                code: "#FFFFFF",
                images: ["/images/products/sneaker-white-1.jpg"]
            },
            {
                name: "Black/Red",
                code: "#FF0000",
                images: ["/images/products/sneaker-blackred-1.jpg"]
            }
        ],
        featured: true,
        rating: 4.6,
        reviewsCount: 78
    }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Clear existing products
        await Product.deleteMany({});
        console.log('Cleared existing products');
        
        // Insert sample products
        await Product.insertMany(sampleProducts);
        console.log('Added sample products');
        
        // Create admin user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const adminUser = new User({
            name: 'Admin User',
            email: 'admin@royalfootwear.com',
            password: hashedPassword,
            role: 'admin'
        });
        
        await adminUser.save();
        console.log('Created admin user');
        
        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();