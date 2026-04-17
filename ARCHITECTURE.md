# 🏗️ Mind Freek - Architecture & System Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Login      │  │   Lobby      │  │   Game       │       │
│  │   Page       │  │   (Matching) │  │   Board      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                  │                │
└─────────┼─────────────────┼──────────────────┼────────────────┘
          │ HTTP/Socket.IO  │   HTTP/Socket.IO │
          └─────────────────┼──────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│        API GATEWAY (Nginx - Load Balancing)                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ - SSL/TLS Termination                              │    │
│  │ - Request Routing                                  │    │
│  │ - Compression (gzip)                              │    │
│  │ - Caching                                         │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   AUTH       │   │   PLAY       │   │   METRICS    │
│   ROUTES     │   │   ROUTES     │   │   ROUTES     │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
┌──────────────────────────────────────────────────────────┐
│              SERVER LAYER (Node.js/Express)              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Authentication Controller                          │  │
│  │ - User registration                               │  │
│  │ - Player matching                                 │  │
│  │ - Room creation                                   │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Play Controller                                    │  │
│  │ - Game flow management                            │  │
│  │ - Player room management                          │  │
│  │ - State synchronization                           │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Socket.IO Handler                                 │  │
│  │ - Real-time drawing sync                          │  │
│  │ - Player disconnect handling                      │  │
│  │ - Game event broadcasting                         │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────┴───────────────────────────────────────────┐
│              BUSINESS LOGIC LAYER                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Game Engine                                        │  │
│  │ - Round management                                │  │
│  │ - Scoring logic                                   │  │
│  │ - Winner detection                                │  │
│  │ - Auto-cleanup                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Error Handler & Monitoring                        │  │
│  │ - Global error handling                           │  │
│  │ - Performance metrics                             │  │
│  │ - Query tracking                                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────┴───────────────────────────────────────────┐
│              DATABASE LAYER (MySQL)                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Tables:                                            │  │
│  │ - users: Player profiles                          │  │
│  │ - rooms: Game rooms                               │  │
│  │ - room_players: Player-room mapping               │  │
│  │ - rounds: Game rounds                             │  │
│  │ - guesses: Player guesses & scores                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Indexes:                                           │  │
│  │ - On status, country (for matching)               │  │
│  │ - On user_id, room_id (for lookups)               │  │
│  │ - On timestamps (for sorting)                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### User Registration & Matching Flow

```
1. User Registration
   ┌─────────────┐
   │ User enters │
   │ details &   │
   │ submits     │
   └──────┬──────┘
          │
   ┌──────▼─────────────────┐
   │ Frontend validation    │
   │ - Username length      │
   │ - Country selected     │
   └──────┬─────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ POST /api/auth/connect          │
   │ Backend creates user in DB      │
   │ Stores socket ID, language      │
   └──────┬───────────────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ Socket event: new-user-online   │
   │ Updates socket_id in DB         │
   │ Broadcasts refresh-players      │
   └──────┬───────────────────────────┘
          │
          ▼
   ✅ User logged in, ready to play

2. Player Matching
   ┌─────────────────────────┐
   │ Show ads & waiting      │
   │ Poll for opponents      │
   │ (5s intervals)          │
   └──────┬──────────────────┘
          │
   ┌──────▼──────────────────────────────────┐
   │ POST /api/auth/getingplayers             │
   │ Find 1 other player (same country)       │
   │ If found: status=3 (ready to play)       │
   └──────┬───────────────────────────────────┘
          │
   ┌──────▼──────────────────────────────┐
   │ Check count == PLAYERS env setting  │
   │ If >= PLAYERS: Auto join room       │
   └──────┬───────────────────────────────┘
          │
   ┌──────▼────────────────────────┐
   │ POST /api/auth/joinroom       │
   │ - Create or fetch room        │
   │ - Add players to room         │
   │ - Update status to 'rooms'    │
   └──────┬─────────────────────────┘
          │
          ▼
   ✅ Players matched, game room created
```

### Game Play Flow

```
3. Game Start
   ┌──────────────────────────┐
   │ Frontend auto-calls      │
   │ POST /api/play/startgame │
   └──────┬───────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ Backend checks:                 │
   │ - At least 2 players?           │
   │ - All in same room?             │
   └──────┬───────────────────────────┘
          │
   ┌──────▼─────────────────────────────┐
   │ Emit 'pre-game-start' event        │
   │ Show 10s countdown to all players  │
   └──────┬──────────────────────────────┘
          │
   ┌──────▼────────────────────────────┐
   │ After countdown, emit 'game-start'│
   │ Set current_turn_user to drawer   │
   │ game_status = 'playing'           │
   └──────┬─────────────────────────────┘
          │
          ▼
   ✅ Game started, drawer gets words

4. Word Selection
   ┌─────────────────────┐
   │ Emit request-words  │
   │ Get 3 word options  │
   └──────┬──────────────┘
          │
   ┌──────▼───────────────────────────┐
   │ Drawer selects word              │
   │ Emit: select-word event          │
   └──────┬──────────────────────────┬─┘
          │                          │
   ┌──────▼──────────┐       ┌──────▼─────────────┐
   │ Broadcast:      │       │ Start round timer  │
   │ - word-selected │       │ - ROUND_TIME secs  │
   │ to other players        │ - Then endRound()  │
   └─────────────────┘       └────────────────────┘
          │
          ▼
   ✅ Drawing starts

5. Drawing & Guessing
   ┌─────────────────────────────┐
   │ Drawer sends strokes        │
   │ Socket: 'draw' event        │
   │ Broadcast to all players    │
   └──────┬──────────────────────┘
          │
   ┌──────▼─────────────────────────────┐
   │ Guesser types guess                │
   │ Socket: 'guess' event              │
   │ Backend validates answer           │
   └──────┬──────────────────────────────┘
          │
          ├─ Correct?
          │
   ┌──────▼──────────────────────┐
   │ If correct:                 │
   │ - Calculate points          │
   │ - Update score              │
   │ - Emit 'score-update'       │
   │ - End round early           │
   │ - Broadcast 'word-reveal'   │
   └──────┬───────────────────────┘
          │
   ┌──────▼──────────────────────┐
   │ If timeout:                 │
   │ - endRound() called         │
   │ - Reveal word              │
   │ - No points awarded        │
   └──────┬───────────────────────┘
          │
          ▼
   ✅ Round ended

6. Turn Complete & Scoring
   ┌─────────────────────────────┐
   │ Broadcast 'turn-complete'  │
   │ - Leaderboard              │
   │ - Next drawer info         │
   │ - 10s popup                │
   └──────┬──────────────────────┘
          │
   ┌──────▼──────────────────────┐
   │ Check if all rounds done:   │
   │ current_round >= total_rounds│
   └──────┬──────────────────────┘
          │
          ├─ No: Next round
          │  └─ Go to step 4
          │
          ├─ Yes: Game over
          │
   ┌──────▼────────────────────────┐
   │ Broadcast 'game-over'         │
   │ - Winner                       │
   │ - Final leaderboard           │
   │ - game_status = 'finished'    │
   └──────┬─────────────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ After 3s delay:                 │
   │ - Delete game data              │
   │ - Clean up round data           │
   │ - Mark room as deleted          │
   │ - Clear player status           │
   └──────┬───────────────────────────┘
          │
          ▼
   ✅ Game ended, cleanup complete
```

## Configuration Hierarchy

```
Environment Variables (.env)
        │
        ▼
config/constants.js
        │
        ├─► GAME settings
        ├─► SERVER settings
        ├─► PERFORMANCE limits
        ├─► SECURITY settings
        └─► VALIDATION rules
        │
        ▼
Controllers & Routes
        │
        ├─► Use game constants
        ├─► Apply validation
        └─► Enforce limits
        │
        ▼
Socket.IO Handlers
        │
        ├─► Use timings
        ├─► Apply rules
        └─► Broadcast events
```

## Error Handling Flow

```
API Request
    │
    ▼
Route Handler
    │
    ├─ Error? 
    │
    ├─► ValidationError (400)
    ├─► DatabaseError (500)
    ├─► NotFoundError (404)
    └─► Generic Error (500)
    │
    ▼
errorHandler Middleware
    │
    ├─► Format error response
    ├─► Log in development
    └─► Hide details in production
    │
    ▼
Send Response to Client
    │
    ├─► {status: 0, message: "..."}
    └─► Appropriate HTTP status
```

## Performance Monitoring

```
PerformanceMonitor (config/monitoring.js)
        │
        ├─► trackQueryTime()
        │   └─► Logs slow queries > 1s
        │
        ├─► incrementSocket()
        │   └─► Counts active connections
        │
        ├─► setActiveRooms()
        │   └─► Tracks room count
        │
        └─► getMetrics()
            └─► Available at /api/metrics
                ├─► activeSockets
                ├─► activeRooms
                ├─► avgQueryTime
                └─► recentQueries
```

## File Structure

```
mindfreek-backend/
├── config/
│   ├── db.js                 # Database connection
│   ├── constants.js          # ✨ Game configuration
│   ├── errorHandler.js       # ✨ Error handling
│   ├── monitoring.js         # ✨ Performance tracking
│   └── .env                  # Environment variables
├── controllers/
│   ├── AuthController.js     # User authentication
│   └── PlayController.js     # Game logic
├── routes/
│   ├── AuthRoute.js
│   └── playRoute.js
├── index.js                  # Main server
├── database_setup.sql        # ✨ DB schema
├── DEPLOYMENT.md             # ✨ Production guide
├── OPTIMIZATION.md           # ✨ Performance tuning
├── STABILITY_CHECKLIST.md    # ✨ QA checklist
└── SUMMARY.md                # ✨ This overview

mindfreek/
├── src/
│   ├── pages/
│   │   ├── Login.jsx
│   │   └── Home.jsx
│   ├── components/
│   │   ├── WordWaitingModal.jsx
│   │   ├── WordSelectModal.jsx
│   │   ├── TurnCompletePopup.jsx
│   │   ├── WinnerPopup.jsx
│   │   └── ... (others)
│   ├── socket.js
│   └── App.js
├── public/
│   ├── index.html            # ✨ SEO optimized
│   └── robots.txt            # ✨ SEO ready
├── .env
├── README_FEATURES.md        # ✨ Feature guide
└── ... (others)
```

✨ = Recently added/optimized

---

This architecture ensures:
- ✅ Scalability (modular design)
- ✅ Maintainability (clear separation)
- ✅ Performance (optimized queries)
- ✅ Reliability (error handling)
- ✅ Monitorability (metrics endpoint)
- ✅ Configurability (centralized config)
