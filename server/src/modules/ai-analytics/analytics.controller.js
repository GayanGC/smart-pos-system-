/**
 * @file analytics.controller.js
 * @module ai-analytics
 * @description Controllers for AI Predictions and Chatbot session management.
 *
 * Routes:
 *  Predictions:
 *    GET  /api/analytics/predictions         – list with filters
 *    POST /api/analytics/predictions         – log a new prediction
 *    GET  /api/analytics/predictions/:id     – get single prediction
 *    GET  /api/analytics/summary             – aggregated sales insights
 *
 *  Chatbot:
 *    POST /api/analytics/chatbot/sessions           – start a new session
 *    POST /api/analytics/chatbot/sessions/:id/message – append a message
 *    GET  /api/analytics/chatbot/sessions            – list sessions
 *    GET  /api/analytics/chatbot/sessions/:id        – get full session
 *    PATCH /api/analytics/chatbot/sessions/:id/end  – end session + rating
 */

const Prediction  = require('./prediction.model');
const ChatbotLog  = require('./chatbotLog.model');
const Invoice     = require('../billing/invoice.model');
const Product     = require('../inventory/product.model');
const asyncHandler       = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseFormatter');
const { v4: uuidv4 }     = require('uuid');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════
//  PREDICTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  List prediction logs
 * @route GET /api/analytics/predictions
 */
const getPredictions = asyncHandler(async (req, res) => {
  const { type, productId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (type)      filter.type              = type;
  if (productId) filter['scope.productId']= productId;

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Prediction.countDocuments(filter);
  const predictions = await Prediction.find(filter)
    .populate('requestedBy', 'name')
    .populate('scope.productId', 'name sku')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: predictions,
    meta: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Predictions retrieved successfully.',
  });
});

/**
 * @desc  Log a new prediction result (from an external ML service)
 * @route POST /api/analytics/predictions
 */
const createPrediction = asyncHandler(async (req, res) => {
  const prediction = await Prediction.create({
    ...req.body,
    requestedBy: req.user._id,
  });
  return sendSuccess(res, { statusCode: 201, data: prediction, message: 'Prediction logged successfully.' });
});

/**
 * @desc  Get a single prediction by ID
 * @route GET /api/analytics/predictions/:id
 */
const getPredictionById = asyncHandler(async (req, res) => {
  const prediction = await Prediction.findById(req.params.id)
    .populate('requestedBy', 'name')
    .populate('scope.productId', 'name sku');
  if (!prediction) {
    return sendError(res, { statusCode: 404, message: 'Prediction not found.' });
  }
  return sendSuccess(res, { data: prediction, message: 'Prediction retrieved successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ANALYTICS SUMMARY — aggregates across Invoice + Product data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  Return high-level business insights for the dashboard
 * @route GET /api/analytics/summary
 * @query startDate, endDate
 */
const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate)   dateFilter.$lte = new Date(endDate);

  const invoiceMatch = {
    isVoided: false,
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
  };

  // ── Total revenue aggregation ─────────────────────────────────────────────
  const [revenueSummary] = await Invoice.aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id:                null,
        totalRevenue:       { $sum: '$grandTotal' },
        totalInvoices:      { $sum: 1 },
        avgOrderValue:      { $avg: '$grandTotal' },
        totalTaxCollected:  { $sum: '$totalTax' },
        totalDiscountGiven: { $sum: '$totalDiscount' },
      },
    },
  ]);

  // ── Top 5 best-selling products ───────────────────────────────────────────
  const topProducts = await Invoice.aggregate([
    { $match: invoiceMatch },
    { $unwind: '$lineItems' },
    {
      $group: {
        _id:          '$lineItems.productId',
        name:         { $first: '$lineItems.name' },
        totalSold:    { $sum: '$lineItems.quantity' },
        totalRevenue: { $sum: '$lineItems.lineTotal' },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
  ]);

  // ── Low-stock count ───────────────────────────────────────────────────────
  const lowStockCount = await Product.countDocuments({
    isActive: true,
    $expr: { $lte: ['$quantityInStock', '$lowStockThreshold'] },
  });

  // ── Sales by payment method ───────────────────────────────────────────────
  const salesByPaymentMethod = await Invoice.aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id:   '$paymentMethod',
        total: { $sum: '$grandTotal' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return sendSuccess(res, {
    data: {
      revenue:             revenueSummary || { totalRevenue: 0, totalInvoices: 0 },
      topProducts,
      lowStockCount,
      salesByPaymentMethod,
    },
    message: 'Analytics summary retrieved successfully.',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CHATBOT SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  Start a new chatbot session
 * @route POST /api/analytics/chatbot/sessions
 */
const startChatSession = asyncHandler(async (req, res) => {
  const { systemPrompt } = req.body;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  const session = await ChatbotLog.create({
    sessionId:   uuidv4(),
    userId:      req.user._id,
    userRole:    req.user.role,
    messages,
    modelUsed:   req.body.modelUsed || 'gpt-4o',
    isActive:    true,
  });

  return sendSuccess(res, { statusCode: 201, data: session, message: 'Chat session started.' });
});

/**
 * @desc  Append a message to an existing session
 * @route POST /api/analytics/chatbot/sessions/:id/message
 * @body  { role: 'user'|'assistant', content: string, tokensUsed?: number }
 */
const appendMessage = asyncHandler(async (req, res) => {
  const { role, content, tokensUsed = 0 } = req.body;

  if (!['user', 'assistant', 'system'].includes(role)) {
    return sendError(res, { statusCode: 400, message: "role must be 'user', 'assistant', or 'system'." });
  }
  if (!content || content.trim() === '') {
    return sendError(res, { statusCode: 400, message: 'Message content is required.' });
  }

  const session = await ChatbotLog.findById(req.params.id);
  if (!session) {
    return sendError(res, { statusCode: 404, message: 'Chat session not found.' });
  }
  if (!session.isActive) {
    return sendError(res, { statusCode: 409, message: 'Cannot append to a closed session.' });
  }

  session.messages.push({ role, content: content.trim(), timestamp: new Date(), tokensUsed });
  session.totalTokensUsed += tokensUsed;
  await session.save();

  return sendSuccess(res, { data: session, message: 'Message appended successfully.' });
});

/**
 * @desc  Process a chat message, fetch context, call Gemini, and log responses
 * @route POST /api/analytics/chat
 * @body  { sessionId: string, content: string }
 */
const processChat = asyncHandler(async (req, res) => {
  const { sessionId, content } = req.body;
  
  if (!content || content.trim() === '') {
    return sendError(res, { statusCode: 400, message: 'Message content is required.' });
  }

  // 1. Fetch or create session
  let session = await ChatbotLog.findOne({ sessionId });
  if (!session) {
    session = await ChatbotLog.create({
      sessionId,
      userId: req.user._id,
      userRole: req.user.role,
      messages: [],
      modelUsed: 'gemini-1.5-pro',
      isActive: true,
    });
  }

  if (!session.isActive) {
    return sendError(res, { statusCode: 409, message: 'Cannot append to a closed session.' });
  }

  // 2. Log User Message
  session.messages.push({ role: 'user', content: content.trim(), timestamp: new Date() });

  // 3. Gather Live Store Context
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Today's Sales and Net Profit
  const [salesSummary] = await Invoice.aggregate([
    { $match: { isVoided: false, createdAt: { $gte: startOfDay, $lte: endOfDay } } },
    { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'lineItems.productId', foreignField: '_id', as: '_productInfo' } },
    { $addFields: { '_resolvedCostPrice': { $ifNull: [{ $arrayElemAt: ['$_productInfo.costPrice', 0] }, 0] } } },
    { $addFields: { 'lineItems.lineCOGS': { $multiply: [{ $ifNull: ['$lineItems.quantity', 0] }, '$_resolvedCostPrice'] } } },
    { $group: { _id: '$_id', grandTotal: { $first: '$grandTotal' }, invoiceCOGS: { $sum: '$lineItems.lineCOGS' } } },
    { $group: { _id: null, totalSales: { $sum: '$grandTotal' }, totalCOGS: { $sum: '$invoiceCOGS' } } },
    { $project: { _id: 0, totalSales: 1, netProfit: { $subtract: ['$totalSales', '$totalCOGS'] } } }
  ]);

  // Low Stock Items
  const lowStockProducts = await Product.find({ 
    isActive: true,
    $expr: { $lte: ['$quantityInStock', '$lowStockThreshold'] } 
  }).select('name quantityInStock lowStockThreshold');

  // Voided Invoices
  const voidedCount = await Invoice.countDocuments({ 
    createdAt: { $gte: startOfDay, $lte: endOfDay }, 
    isVoided: true 
  });

  const contextData = {
    todaySales: salesSummary ? salesSummary.totalSales : 0,
    netProfitToday: salesSummary ? salesSummary.netProfit : 0,
    voidedInvoicesToday: voidedCount,
    lowStockItemsCount: lowStockProducts.length,
    lowStockItemsDetails: lowStockProducts.map(p => `${p.name} (Qty: ${p.quantityInStock}, Threshold: ${p.lowStockThreshold})`)
  };

  const systemInstruction = `You are an elite AI Business Manager and Consultant for a retail store POS/ERP system. You have direct access to the live store data provided in the context. Answer the owner's questions accurately based on this data. Keep answers actionable, professional, and concise. You must fully support English, professional Sinhala, and conversational Singlish based on how the user greets or queries you.

LIVE CONTEXT:
${JSON.stringify(contextData, null, 2)}`;

  try {
    // 4. Call OpenAI-compatible REST API or fallback
    const apiKey = process.env.AI_CHAT_API_KEY;
    let responseText = '';

    if (!apiKey || apiKey === 'your_openai_or_openrouter_api_key_here') {
      console.log(`[AI DIAGNOSTICS] No valid AI_CHAT_API_KEY provided. Using local mock fallback.`);
      
      // Generate a mock response based on the actual DB context
      responseText = `(Mock AI Response) Here is your store summary:\n` +
        `- Today's Sales: $${contextData.todaySales.toFixed(2)}\n` +
        `- Net Profit: $${contextData.netProfitToday.toFixed(2)}\n` +
        `- Low Stock Items: ${contextData.lowStockItemsCount}\n\n` +
        `To enable real AI, please update AI_CHAT_API_KEY in your .env file.`;
    } else {
      const maskedKey = apiKey.length > 5 ? `${apiKey.substring(0, 4)}... (Length: ${apiKey.length})` : apiKey;
      console.log(`[AI DIAGNOSTICS] Read AI_CHAT_API_KEY from env:`, maskedKey);

      // Format history for OpenAI format (role: system/user/assistant)
      const formattedHistory = session.messages
        .filter(m => m.role !== 'system')
        .slice(0, -1) // Exclude the user message we just pushed
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const payload = {
        model: process.env.AI_CHAT_MODEL,
        messages: [
          { role: 'system', content: systemInstruction },
          ...formattedHistory,
          { role: 'user', content: content.trim() }
        ],
        temperature: 0.7
      };

      const endpoint = process.env.AI_CHAT_BASE_URL;
      
      const result = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      responseText = result.data.choices[0].message.content;
    }

    // 5. Log Assistant Message
    session.messages.push({ role: 'assistant', content: responseText, timestamp: new Date() });
    await session.save();

    return sendSuccess(res, { data: { role: 'assistant', content: responseText }, message: 'Chat processed successfully.' });
  } catch (error) {
    console.error('AI REST API Error:', error.response?.data || error.message);
    // Even if AI fails, save the user message
    await session.save();
    return sendError(res, { 
      statusCode: 500, 
      message: error.response?.data?.error?.message || 'AI failed to respond. Please check your API key or connection.' 
    });
  }
});

/**
 * @desc  List all chatbot sessions (admin view)
 * @route GET /api/analytics/chatbot/sessions
 */
const getChatSessions = asyncHandler(async (req, res) => {
  const { resolved, userId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (resolved !== undefined) filter.resolved = resolved === 'true';
  if (userId) filter.userId = userId;

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await ChatbotLog.countDocuments(filter);
  const sessions = await ChatbotLog.find(filter)
    .populate('userId', 'name email')
    .select('-messages') // exclude messages in list view for performance
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: sessions,
    meta: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Chat sessions retrieved successfully.',
  });
});

/**
 * @desc  Get full session with all messages
 * @route GET /api/analytics/chatbot/sessions/:id
 */
const getChatSessionById = asyncHandler(async (req, res) => {
  const session = await ChatbotLog.findById(req.params.id).populate('userId', 'name email');
  if (!session) {
    return sendError(res, { statusCode: 404, message: 'Session not found.' });
  }
  return sendSuccess(res, { data: session, message: 'Session retrieved successfully.' });
});

/**
 * @desc  End a chatbot session + collect rating
 * @route PATCH /api/analytics/chatbot/sessions/:id/end
 * @body  { resolved?: boolean, resolutionNote?: string, rating?: number, feedback?: string }
 */
const endChatSession = asyncHandler(async (req, res) => {
  const { resolved, resolutionNote, rating, feedback } = req.body;

  const session = await ChatbotLog.findById(req.params.id);
  if (!session) {
    return sendError(res, { statusCode: 404, message: 'Session not found.' });
  }
  if (!session.isActive) {
    return sendError(res, { statusCode: 409, message: 'Session is already closed.' });
  }

  session.isActive       = false;
  session.endedAt        = new Date();
  if (resolved !== undefined)    session.resolved       = resolved;
  if (resolutionNote)            session.resolutionNote = resolutionNote;
  if (rating)                    session.rating         = rating;
  if (feedback)                  session.feedback       = feedback;

  await session.save();
  return sendSuccess(res, { data: session, message: 'Session ended successfully.' });
});

module.exports = {
  getPredictions, createPrediction, getPredictionById,
  getAnalyticsSummary,
  startChatSession, appendMessage, processChat, getChatSessions, getChatSessionById, endChatSession,
};
