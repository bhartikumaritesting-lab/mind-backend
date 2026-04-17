/**
 * Application Constants & Configuration
 * Loaded from environment variables with fallbacks
 */

module.exports = {
  // Database
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || '',
    DATABASE: process.env.DB_NAME || 'mindfreek'
  },

  // Server
  SERVER: {
    PORT: parseInt(process.env.PORT) || 5001,
    NODE_ENV: process.env.NODE_ENV || 'development'
  },

  // Game Settings
  GAME: {
    PLAYERS: parseInt(process.env.PLAYERS) || 2,
    TOTAL_ROUNDS: parseInt(process.env.TOTAL_ROUNDS) || 2,
    ROUND_TIME: parseInt(process.env.ROUND_TIME) || 100,
    PRE_GAME_COUNTDOWN: parseInt(process.env.PRE_GAME_COUNTDOWN) || 10,
    TURN_POPUP_DURATION: parseInt(process.env.TURN_POPUP_DURATION) || 10,
    GAME_OVER_CLEANUP_DELAY: parseInt(process.env.GAME_OVER_CLEANUP_DELAY) || 3,
    MATCH_SEARCH_TIMEOUT: parseInt(process.env.MATCH_SEARCH_TIMEOUT) || 30
  },

  // Performance
  PERFORMANCE: {
    MAX_CONNECTIONS: 100,
    DB_POOL_SIZE: 10,
    REQUEST_TIMEOUT: 30000,
    SOCKET_TIMEOUT: 30000
  },

  // Security
  SECURITY: {
    MAX_ROOMS_PER_IP: 5,
    MAX_PLAYERS_PER_IP: 3,
    BAN_DURATION_MS: 3600000 // 1 hour
  },

  // Validation
  VALIDATION: {
    MIN_USERNAME_LENGTH: 2,
    MAX_USERNAME_LENGTH: 20,
    MIN_WORD_LENGTH: 2,
    MAX_WORD_LENGTH: 50,
    MAX_GUESS_LENGTH: 100
  }
}
