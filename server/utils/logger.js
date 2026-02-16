const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'giftsity' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log'), maxsize: 5242880, maxFiles: 5 })
  ]
});

// Always log to console (Render, Railway, etc. capture stdout/stderr)
logger.add(new winston.transports.Console({
  format: process.env.NODE_ENV === 'production'
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      )
}));

module.exports = logger;
