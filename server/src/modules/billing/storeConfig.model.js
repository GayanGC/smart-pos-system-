const mongoose = require('mongoose');

const StoreConfigSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: [true, 'Store ID is required.'],
      unique: true,
      trim: true,
    },
    storeName: {
      type: String,
      required: [true, 'Store name is required.'],
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    receiptFooter: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StoreConfig', StoreConfigSchema);
