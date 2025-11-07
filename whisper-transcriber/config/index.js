require('dotenv').config();

/**
 * Configuration module
 * Centralizes all application configuration and validates environment variables
 */

class Config {
  constructor() {
    this.validateRequired();
    this.loadConfig();
  }

  /**
   * Validate required environment variables
   */
  validateRequired() {
    const required = ['OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Load and structure configuration
   */
  loadConfig() {
    this.server = {
      port: parseInt(process.env.PORT, 10) || 3000,
      env: process.env.NODE_ENV || 'development',
      corsOrigin: process.env.CORS_ORIGIN || '*'
    };

    this.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
      gptModel: process.env.GPT_MODEL || 'gpt-4-turbo-preview',
      temperature: parseFloat(process.env.GPT_TEMPERATURE) || 0.7
    };

    this.uploads = {
      directory: process.env.UPLOAD_DIR || 'uploads/',
      maxSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 25 * 1024 * 1024, // 25MB
      allowedMimeTypes: [
        'audio/mpeg',
        'audio/wav',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/m4a'
      ]
    };

    this.audio = {
      chunkSize: parseInt(process.env.AUDIO_CHUNK_SIZE, 10) || 3,
      maxChunkBuffer: parseInt(process.env.MAX_CHUNK_BUFFER, 10) || 10
    };

    this.exports = {
      directory: process.env.EXPORT_DIR || 'exports/'
    };

    this.logging = {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json'
    };
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this.server.env === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction() {
    return this.server.env === 'production';
  }

  /**
   * Check if running in test mode
   */
  isTest() {
    return this.server.env === 'test';
  }
}

// Export singleton instance
module.exports = new Config();
