/**
 * @file chatbotLog.model.js
 * @module ai-analytics
 * @description Schema for logging AI chatbot / assistant conversations.
 *
 * Each document represents one full conversation session. Individual
 * messages within the session are stored as an embedded messages array
 * to keep related conversation turns together.
 *
 * Use cases:
 * - Training data collection for fine-tuning
 * - Audit / compliance logging
 * - Analytics (most common queries, resolution rates)
 */

const mongoose = require('mongoose');

// ─── Individual message sub-schema ─────────────────────────────────────────
const MessageSchema = new mongoose.Schema(
  {
    role: {
      type:    String,
      enum:    ['user', 'assistant', 'system'],
      required: true,
    },
    content:   { type: String, required: true },
    timestamp: { type: Date,   default: Date.now },

    // Track token usage for cost monitoring
    tokensUsed: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────
const ChatbotLogSchema = new mongoose.Schema(
  {
    // ── Session identification ────────────────────────────────────────────────
    sessionId: {
      type:     String,
      required: [true, 'Session ID is required.'],
      index:    true,
    },

    // ── Who initiated the chat ────────────────────────────────────────────────
    userId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   'User',
      index: true,
    },
    userRole: { type: String, trim: true },

    // ── Conversation ──────────────────────────────────────────────────────────
    messages: [MessageSchema],

    // ── AI model metadata ────────────────────────────────────────────────────
    modelUsed:       { type: String, trim: true, default: 'gpt-4o' },
    totalTokensUsed: { type: Number, default: 0 },

    // ── Intent / topic classification ────────────────────────────────────────
    detectedIntent: { type: String, trim: true },  // e.g. "inventory_query"
    resolved:       { type: Boolean, default: false },
    resolutionNote: { type: String, maxlength: 500 },

    // ── Session state ─────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    endedAt:  { type: Date },

    // ── User feedback ─────────────────────────────────────────────────────────
    rating:   { type: Number, min: 1, max: 5 },
    feedback: { type: String, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
ChatbotLogSchema.index({ sessionId: 1 });
ChatbotLogSchema.index({ userId: 1, createdAt: -1 });
ChatbotLogSchema.index({ resolved: 1 });

module.exports = mongoose.model('ChatbotLog', ChatbotLogSchema);
