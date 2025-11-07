const config = require('../config');

/**
 * Logger utility
 * Provides structured logging with different levels
 */

class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[config.logging.level] || this.levels.info;
    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m', // Gray
      reset: '\x1b[0m'
    };
  }

  /**
   * Format log message
   */
  format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    if (config.logging.format === 'json') {
      return JSON.stringify(logData);
    }

    // Pretty format for development
    const metaStr = Object.keys(meta).length > 0 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  /**
   * Log message with color in development
   */
  log(level, message, meta = {}) {
    if (this.levels[level] > this.currentLevel) {
      return; // Skip if level is above current threshold
    }

    const formattedMessage = this.format(level, message, meta);
    
    if (config.isDevelopment() && process.stdout.isTTY) {
      console.log(`${this.colors[level]}${formattedMessage}${this.colors.reset}`);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    if (meta instanceof Error) {
      meta = {
        error: meta.message,
        stack: meta.stack
      };
    }
    this.log('error', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Create child logger with context
   */
  child(context) {
    return {
      error: (msg, meta = {}) => this.error(msg, { ...context, ...meta }),
      warn: (msg, meta = {}) => this.warn(msg, { ...context, ...meta }),
      info: (msg, meta = {}) => this.info(msg, { ...context, ...meta }),
      debug: (msg, meta = {}) => this.debug(msg, { ...context, ...meta })
    };
  }
}

// Export singleton instance
module.exports = new Logger();
