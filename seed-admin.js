const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/elite-residency');
    const adminExists = await User.findOne({ email: 'admin@elite.com' });
    
    if (adminExists) {
      console.log('Admin already exists.');
    } else {
      await User.create({
        name: 'Admin',
        email: 'admin@elite.com',
        password: 'adminpassword',
        role: 'admin'
      });
      console.log('Admin user created: admin@elite.com / adminpassword');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();
