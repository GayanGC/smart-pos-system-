/**
 * @file prediction.model.js
 * @module ai-analytics
 * @description Schema for AI-generated predictions (sales forecasts,
 *              demand forecasts, restock suggestions).
 *
 * The actual ML inference is performed by an external AI service
 * (e.g. Python FastAPI + scikit-learn / TensorFlow Serving).
 * This schema logs every prediction request + response for:
 * - Audit trail
 * - Model performance monitoring
 * - Dashboard visualisation
 */

const mongoose = require('mongoose');
const { PREDICTION_TYPE } = require('../../config/constants');

const PredictionSchema = new mongoose.Schema(
  {
    // ── Type of prediction ────────────────────────────────────────────────────
    type: {
      type:     String,
      required: [true, 'Prediction type is required.'],
      enum:     Object.values(PREDICTION_TYPE),
      index:    true,
    },

    // ── Scope — what entity this prediction is for ────────────────────────────
    scope: {
      productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product'  },
      categoryName:{ type: String, trim: true },
      branchName:  { type: String, trim: true },
    },

    // ── Time horizon ──────────────────────────────────────────────────────────
    forecastPeriodStart: { type: Date },
    forecastPeriodEnd:   { type: Date },

    // ── Prediction output ─────────────────────────────────────────────────────
    predictedValue: {
      type:     Number,
      required: [true, 'Predicted value is required.'],
    },
    confidenceScore: {
      type: Number,
      min:  0,
      max:  1, // 0.0 – 1.0
    },
    unit: { type: String, default: 'units', trim: true },

    // ── Raw response from the ML service (for debugging / retraining) ─────────
    rawModelOutput: { type: mongoose.Schema.Types.Mixed },

    // ── Who triggered this prediction ─────────────────────────────────────────
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    // ── Whether the prediction has been reviewed / acted upon ─────────────────
    isActedUpon: { type: Boolean, default: false },
    actionNotes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
PredictionSchema.index({ type: 1, createdAt: -1 });
PredictionSchema.index({ 'scope.productId': 1 });

module.exports = mongoose.model('Prediction', PredictionSchema);
