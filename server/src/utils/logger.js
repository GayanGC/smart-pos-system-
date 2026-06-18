/**
 * @file logger.js
 * @description Configures the Winston logger with structured, levelled logging.
 *              In development, logs are colourised for readability.
 *              In production, logs are stored as JSON in the /logs directory.
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

// ─── Custom log format ─────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// ─── Logger instance ───────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // print full stack traces for Error objects
    logFormat
  ),
  transports: [
    // Always write errors to a dedicated file
    new transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      handleExceptions: true,
    }),
    // Write all levels to a combined log
    new transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

// ─── Development: pretty-print to the console ──────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
      handleExceptions: true,
    })
  );
}

module.exports = logger;
