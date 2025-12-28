const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    try {
        // Connect
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shoe_royale');
        console.log('✅ MongoDB Connected');
        
        // Simple User schema
        const userSchema = new mongoose.Schema({
            name: String,
            email: String,
            password: String,
            role: String
        });
        
        const User = mongoose.model('User', userSchema);
        
        // Hash password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        // Create admin
        await User.create({
            name: 'Admin User',
            email: 'admin@royalfootwear.com',
            password: hashedPassword,
            role: 'admin'
        });
        
        console.log('✅ Admin created successfully!');
        console.log('📧 Email: admin@royalfootwear.com');
        console.log('🔑 Password: admin123');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdmin();