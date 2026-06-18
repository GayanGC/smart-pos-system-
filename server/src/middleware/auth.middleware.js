/**
 * @file auth.middleware.js
 * @description JWT-based authentication and role-based access control (RBAC)
 *              middleware for Express routes.
 *
 * Usage:
 *   router.get('/protected', protect, route handler)
 *   router.get('/admin-only', protect, authorize('admin', 'super_admin'), handler)
 */

const jwt        = require('jsonwebtoken');
const User       = require('../modules/auth/auth.model');
const asyncHandler = require('../utils/asyncHandler');
const { sendError } = require('../utils/responseFormatter');

// ─── protect ──────────────────────────────────────────────────────────────
/**
 * Validates the Bearer JWT in the Authorization header.
 * Attaches the decoded user document to req.user on success.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Extract token from the Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, { statusCode: 401, message: 'Not authorised — no token provided.' });
  }

  // 2. Verify and decode the token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expired — please log in again.'
      : 'Invalid token — authentication failed.';
    return sendError(res, { statusCode: 401, message });
  }

  // 3. Fetch the user and ensure they still exist / are still active
  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return sendError(res, { statusCode: 401, message: 'User belonging to this token no longer exists.' });
  }
  if (!user.isActive) {
    return sendError(res, { statusCode: 403, message: 'Account is deactivated. Contact an administrator.' });
  }

  // 4. Attach the user to the request object for downstream handlers
  req.user = user;
  next();
});

// ─── authorize ────────────────────────────────────────────────────────────
/**
 * Role-based access control. Call after `protect`.
 *
 * @param {...string} roles  Allowed role strings (see constants.js USER_ROLES)
 * @returns {Function}       Express middleware
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, {
      statusCode: 403,
      message: `Role '${req.user.role}' is not authorised to access this resource.`,
    });
  }
  next();
};

module.exports = { protect, authorize };
