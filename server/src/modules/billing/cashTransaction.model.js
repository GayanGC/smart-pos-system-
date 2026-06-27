const mongoose = require('mongoose');

const cashTransactionSchema = new mongoose.Schema(
  {
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cashier',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['payout', 'payin', 'starting_drawer', 'customer_debt_collection', 'supplier_debt_payment'],
      default: 'payout',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// Index for shift settlement lookups by date
cashTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CashTransaction', cashTransactionSchema);
