/**
 * @file app.js
 * @description Express application factory.
 *
 * This file configures and returns the Express app instance WITHOUT
 * starting the HTTP server. The server is started separately in server.js.
 * This separation makes the app easily testable (import app → supertest).
 *
 * Middleware stack (in order):
 * 1.  helmet          — sets secure HTTP headers
 * 2.  cors            — cross-origin resource sharing
 * 3.  morgan          — HTTP request logger
 * 4.  express.json    — parse JSON bodies
 * 5.  mongoSanitize   — prevent NoSQL injection
 * 6.  compression     — gzip responses
 * 7.  globalLimiter   — rate limiting for all routes
 * 8.  Module routers  — domain-specific route handlers
 * 9.  404 handler     — catches unmatched routes
 * 10. errorHandler    — centralised error response
 */

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const morgan        = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const compression   = require('compression');

const { globalLimiter }  = require('./middleware/rateLimiter.middleware');
const errorHandler       = require('./middleware/error.middleware');
const logger             = require('./utils/logger');

// ── Module routers ─────────────────────────────────────────────────────────
const authRoutes       = require('./modules/auth/auth.routes');
const inventoryRoutes  = require('./modules/inventory/inventory.routes');
const billingRoutes    = require('./modules/billing/billing.routes');
const employeeRoutes   = require('./modules/employees/employees.routes');
const analyticsRoutes  = require('./modules/ai-analytics/analytics.routes');

// ─── Create Express app ────────────────────────────────────────────────────
const app = express();

// ─── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'https://smart-pos-system-five.vercel.app',
];

if (process.env.CLIENT_ORIGIN) {
  allowedOrigins.push(process.env.CLIENT_ORIGIN);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── HTTP request logging ──────────────────────────────────────────────────
// Use 'combined' format in production for structured logs; 'dev' for coloured dev output
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// ─── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));       // parse application/json
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // parse form data

// ─── NoSQL injection prevention ────────────────────────────────────────────
// Strips `$` and `.` from query strings / body to prevent injection attacks
app.use(mongoSanitize());

// ─── Gzip compression ─────────────────────────────────────────────────────
app.use(compression());

// ─── Global rate limiter ───────────────────────────────────────────────────
app.use('/api', globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const rawUri = process.env.MONGO_URI || '';
  const obfuscatedUri = rawUri.replace(/:([^@]+)@/, ':******@');
  res.status(200).json({
    success: true,
    status:  'OK',
    env:     process.env.NODE_ENV,
    uptime:  process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name,
      uri: obfuscatedUri,
      host: mongoose.connection.host
    }
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/billing',    billingRoutes);
app.use('/api/employees',  employeeRoutes);
app.use('/api/analytics',  analyticsRoutes);

// ─── 404 — Unmatched routes ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' not found on this server.`,
  });
});

// ─── Centralised error handler (must be last) ──────────────────────────────
app.use(errorHandler);

module.exports = app;
