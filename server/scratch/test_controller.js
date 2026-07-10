require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { getProducts } = require('../src/modules/inventory/inventory.controller');

const testController = async () => {
  try {
    const mongoString = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoString);
    console.log('Connected to DB.');

    // Mock Express req and res
    const req = {
      query: {
        limit: 100,
      },
      user: {
        storeId: 'store_1',
      },
    };

    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        console.log('--- RESPONSE STATUS ---', this.statusCode || 200);
        console.log('--- RESPONSE DATA ---');
        console.log(JSON.stringify(data, null, 2));
      },
    };

    const next = (err) => console.error('--- NEXT ERROR ---', err);

    // run controller
    getProducts(req, res, next);

    setTimeout(() => {
      process.exit(0);
    }, 3000);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

testController();
