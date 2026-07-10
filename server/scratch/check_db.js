require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Product = require('../src/modules/inventory/product.model');
const User = require('../src/modules/auth/auth.model');

const checkDB = async () => {
  try {
    const mongoString = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to:', mongoString.replace(/:([^@]+)@/, ':******@'));
    await mongoose.connect(mongoString);
    console.log('✅ Connected.');

    const users = await User.find({}, 'name email role storeId');
    console.log('--- USERS IN DATABASE ---');
    console.log(users);

    const products = await Product.find({});
    console.log('--- PRODUCTS IN DATABASE ---');
    console.log(`Total products: ${products.length}`);
    products.forEach(p => {
      console.log(`- Name: "${p.name}" | SKU: "${p.sku}" | Category: "${p.category}" | StoreId: "${p.storeId}" | isActive: ${p.isActive}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkDB();
