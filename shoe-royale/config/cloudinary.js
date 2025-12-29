// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config(); // Load .env file

console.log('Loading Cloudinary config...');
console.log('Cloud name from env:', process.env.CLOUDINARY_CLOUD_NAME);

// Check if credentials exist
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ ERROR: Cloudinary credentials missing in .env file');
  console.error('Please set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  // Use dummy credentials to prevent crash
  cloudinary.config({
    cloud_name: 'dummy',
    api_key: 'dummy',
    api_secret: 'dummy'
  });
} else {
  // Use actual credentials
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('✅ Cloudinary configured successfully');
}

module.exports = cloudinary;