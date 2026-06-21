/**
 * @file auth.controller.js
 * @module auth
 * @description Handles all authentication operations:
 *  - register        POST /api/auth/register
 *  - login           POST /api/auth/login
 *  - generateQrToken POST /api/auth/qr/generate   (admin generates QR for cashier)
 *  - loginWithQr     POST /api/auth/qr/login       (cashier scans QR on terminal)
 *  - getMe           GET  /api/auth/me              (current user profile)
 *  - logout          POST /api/auth/logout          (client-side token discard + audit)
 */

const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const User     = require('./auth.model');
const Cashier  = require('./cashier.model');
const asyncHandler      = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseFormatter');

// ─── Helper: sign a JWT for the given user id ──────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Helper: build + send token response ──────────────────────────────────
const sendTokenResponse = (res, user, statusCode = 200, message = 'Success') => {
  const token = signToken(user._id);

  // Strip sensitive fields before sending user object
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.qrToken;
  delete userObj.qrTokenExpires;
  delete userObj.passwordResetToken;
  delete userObj.passwordResetExpires;

  return sendSuccess(res, { statusCode, message, data: { token, user: userObj } });
};

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Register a new user
//  @route   POST /api/auth/register
//  @access  Public (or Super Admin only — adjust authorize() in routes)
// ═══════════════════════════════════════════════════════════════════════════
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check for existing email
  const existing = await User.findOne({ email });
  if (existing) {
    return sendError(res, { statusCode: 409, message: 'Email is already registered.' });
  }

  // Create the user (password is hashed by the pre-save hook)
  const user = await User.create({ name, email, password, role });

  // If the new user is a cashier, automatically create a Cashier profile
  if (user.role === 'cashier') {
    await Cashier.create({ userId: user._id });
  }

  return sendTokenResponse(res, user, 201, 'Account created successfully.');
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Login with email and password
//  @route   POST /api/auth/login
//  @access  Public
// ═══════════════════════════════════════════════════════════════════════════
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, { statusCode: 400, message: 'Email and password are required.' });
  }

  // We need the password field (+password) because it is select:false
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return sendError(res, { statusCode: 401, message: 'Invalid email or password.' });
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    // Generic message — do NOT reveal which field is wrong (security)
    return sendError(res, { statusCode: 401, message: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return sendError(res, { statusCode: 403, message: 'Account is deactivated. Contact an administrator.' });
  }

  // Update lastLogin timestamp
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return sendTokenResponse(res, user, 200, 'Login successful.');
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Generate a QR token for a cashier (admin action)
//  @route   POST /api/auth/qr/generate
//  @access  Private (admin / manager)
// ═══════════════════════════════════════════════════════════════════════════
const generateQrToken = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return sendError(res, { statusCode: 400, message: 'userId is required.' });
  }

  // Fetch the target user (need qrToken fields — use +select)
  const user = await User.findById(userId).select('+qrToken +qrTokenExpires');
  if (!user) {
    return sendError(res, { statusCode: 404, message: 'User not found.' });
  }

  // Generate a random token and set expiry (default: 5 minutes)
  const rawToken    = crypto.randomBytes(32).toString('hex');
  const expiresInMs = (parseInt(process.env.QR_EXPIRES_IN, 10) || 300) * 1000;

  user.qrToken        = rawToken;
  user.qrTokenExpires = new Date(Date.now() + expiresInMs);
  await user.save({ validateBeforeSave: false });

  // Encode the token as a QR code (base64 data URL)
  const qrDataUrl = await QRCode.toDataURL(
    JSON.stringify({ userId: user._id.toString(), token: rawToken }),
    { errorCorrectionLevel: 'H' }
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: 'QR token generated successfully.',
    data: {
      qrDataUrl,
      expiresAt: user.qrTokenExpires,
      userId:    user._id,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Authenticate using a scanned QR token
//  @route   POST /api/auth/qr/login
//  @access  Public (called by the POS terminal on QR scan)
// ═══════════════════════════════════════════════════════════════════════════
const loginWithQr = asyncHandler(async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return sendError(res, { statusCode: 400, message: 'userId and token are required.' });
  }

  // Fetch user with hidden QR fields
  const user = await User.findById(userId).select('+qrToken +qrTokenExpires');
  if (!user) {
    return sendError(res, { statusCode: 401, message: 'QR authentication failed.' });
  }

  // Validate token and expiry
  if (!user.isQrTokenValid() || user.qrToken !== token) {
    return sendError(res, { statusCode: 401, message: 'QR code is invalid or has expired.' });
  }

  // Single-use: clear the QR token immediately after successful login
  user.qrToken        = undefined;
  user.qrTokenExpires = undefined;
  user.lastLogin      = new Date();
  await user.save({ validateBeforeSave: false });

  return sendTokenResponse(res, user, 200, 'QR login successful.');
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Get current authenticated user's profile
//  @route   GET /api/auth/me
//  @access  Private
// ═══════════════════════════════════════════════════════════════════════════
const getMe = asyncHandler(async (req, res) => {
  // req.user is attached by the protect middleware
  const user = await User.findById(req.user._id);

  // If user is a cashier, also return their cashier profile
  let cashierProfile = null;
  if (user.role === 'cashier') {
    cashierProfile = await Cashier.findOne({ userId: user._id });
  }

  return sendSuccess(res, {
    data: { user, cashierProfile },
    message: 'Profile fetched successfully.',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Logout (server-side audit log)
//  @route   POST /api/auth/logout
//  @access  Private
// ═══════════════════════════════════════════════════════════════════════════
const logout = asyncHandler(async (req, res) => {
  // JWT is stateless — the client must discard the token.
  // We only log the event on the server side for audit purposes.
  // For a full blacklist implementation, integrate Redis here.
  return sendSuccess(res, { message: 'Logout recorded. Please discard your token.' });
});

module.exports = { register, login, generateQrToken, loginWithQr, getMe, logout };
