/**
 * Performance Monitoring
 */

const metrics = {
  queries: [],
  sockets: 0,
  activeRooms: 0
}

class PerformanceMonitor {
  static trackQueryTime(query, duration) {
    metrics.queries.push({
      query: query.substring(0, 100),
      duration,
      timestamp: Date.now()
    })

    // Keep only last 100 queries
    if (metrics.queries.length > 100) {
      metrics.queries.shift()
    }

    if (duration > 1000) {
      console.log(`⚠️ SLOW QUERY (${duration}ms): ${query.substring(0, 100)}...`)
    }
  }

  static incrementSocket() {
    metrics.sockets++
    console.log(`🔗 Active Sockets: ${metrics.sockets}`)
  }

  static decrementSocket() {
    metrics.sockets--
    console.log(`🔗 Active Sockets: ${metrics.sockets}`)
  }

  static setActiveRooms(count) {
    metrics.activeRooms = count
  }

  static getMetrics() {
    const avgQueryTime = metrics.queries.length > 0
      ? metrics.queries.reduce((sum, q) => sum + q.duration, 0) / metrics.queries.length
      : 0

    return {
      activeSockets: metrics.sockets,
      activeRooms: metrics.activeRooms,
      totalQueries: metrics.queries.length,
      avgQueryTime: avgQueryTime.toFixed(2),
      recentQueries: metrics.queries.slice(-10)
    }
  }

  static reset() {
    metrics.queries = []
    metrics.sockets = 0
    metrics.activeRooms = 0
  }
}

module.exports = PerformanceMonitor
