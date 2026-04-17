/**
 * Error Handler Middleware
 */

const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message)
  
  if (res.headersSent) {
    return next(err)
  }

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  return res.status(statusCode).json({
    status: 0,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

/**
 * Async Handler - Wrap async route handlers to catch errors
 */
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * Validation Error
 */
class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.statusCode = 400
  }
}

/**
 * Database Error
 */
class DatabaseError extends Error {
  constructor(message) {
    super(message)
    this.statusCode = 500
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.statusCode = 404
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  ValidationError,
  DatabaseError,
  NotFoundError
}
