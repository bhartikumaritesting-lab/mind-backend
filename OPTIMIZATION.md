# Mind Freek - Configuration & Optimization Guide

## 🔧 Configuration Files

### Backend Configuration (`config/constants.js`)
All game settings, timings, and limits are centralized in one file. No need to touch code!

```
PLAYERS=3                    # Number of players per game
TOTAL_ROUNDS=3               # Total rounds per game
ROUND_TIME=100               # Seconds per round
PRE_GAME_COUNTDOWN=10        # Seconds before game starts
TURN_POPUP_DURATION=10       # Popup display time
GAME_OVER_CLEANUP_DELAY=3    # Cleanup delay after game ends
MATCH_SEARCH_TIMEOUT=30      # Matchmaking search timeout
```

## 📊 Performance Monitoring

Access metrics at: `http://localhost:5001/api/metrics`

Shows:
- Active socket connections
- Active game rooms
- Average query time
- Recent database queries

## 🔒 Security Features

- Max connections limit per IP
- Rate limiting support
- Input validation
- Error handling middleware

## ⚡ Performance Optimizations

1. **Database Query Optimization**
   - Using prepared statements
   - Connection pooling ready
   - Index queries for fast lookups

2. **Socket.IO Optimization**
   - Event-based communication
   - Room-based broadcasting
   - Automatic cleanup on disconnect

3. **Error Handling**
   - Global error handler
   - Async error catching
   - Detailed logging in development

## 🌐 SEO Implementation

- ✅ Meta tags for social sharing
- ✅ JSON-LD structured data
- ✅ Open Graph tags
- ✅ Twitter cards
- ✅ Robots.txt configured
- ✅ Mobile-friendly responsive design

## 📝 Testing Endpoints

```bash
# Health check
curl http://localhost:5001/

# Performance metrics
curl http://localhost:5001/api/metrics

# Game status
curl -X POST http://localhost:5001/api/play/getplayerroom \
  -H "Content-Type: application/json" \
  -d '{"roomId": "1"}'
```

## 🚀 Deployment Checklist

- [ ] Update .env with production values
- [ ] Set NODE_ENV=production
- [ ] Enable database connection pooling
- [ ] Configure CORS for frontend domain
- [ ] Setup SSL/TLS certificates
- [ ] Configure CDN for static assets
- [ ] Setup monitoring and logging
- [ ] Configure backup strategy

## 📱 Frontend Optimization

- Code splitting with React.lazy
- Component memoization
- Socket connection reuse
- Environment variable management

## 🎮 Game Features

✅ Multiplayer matchmaking
✅ Real-time drawing synchronization
✅ Player disconnect handling
✅ Automatic winner detection
✅ Dynamic round configuration
✅ Score tracking

## 📈 Future Optimizations

- Database indexing
- Query caching with Redis
- Websocket compression
- Image optimization
- API response caching
- Load balancing setup
