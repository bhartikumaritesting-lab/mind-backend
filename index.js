const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const axios = require('axios')
const db = require('./config/db')
const loginRoutes = require('./routes/AuthRoute')
const playRoutes = require('./routes/playRoute')
const socketIO = require('socket.io')
const constants = require('./config/constants')
const { errorHandler } = require('./config/errorHandler')
const PerformanceMonitor = require('./config/monitoring')

dotenv.config()

let isDBConnected = false

db.getConnection((err, connection) => {
  if (err) {
    console.log('❌ DB Connection Failed:', err.message)
    isDBConnected = false
  } else {
    console.log('✅ DB Connected Successfully')
    isDBConnected = true
    connection.release()
  }
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Create HTTP server
const server = http.createServer(app)

// Init socket.io
const io = socketIO(server, {
  cors: {
    origin: '*'
  }
})

const WORDS = [
  'daru',
  'bebda',
  'bhai',
  'yaar',
  'chadha',
  'peg',
  'shot',
  'chill',
  'mast',
  'bindaas',
  'jugaad',
  'bakchodi',
  'timepass',
  'bawaal',
  'tamasha',
  'masti',
  'tharki',
  'pataka',
  'chhotu',
  'bhaiya',
  'gandu',
  'chutiya',
  'bewda',
  'sharabi',
  'nachaniya',
  'pagal',
  'deewana',
  'jhakkas',
  'khatarnak',
  'setting',
  'crush',
  'padosan',
  'aunty',
  'uncle',
  'chai',
  'sutta',
  'cutting',
  'tapri',
  'addha',
  'faltu',
  'bakwas',
  'desi',
  'local',
  'vibes',
  'swag',
  'attitude',
  'style',
  'mood',
  'hungama',
  'golmaal',
  'dhamaal'
]

const ROUND_TIME = constants.GAME.ROUND_TIME
const ROUND_TIMER = ROUND_TIME * 1000
const roundTimers = {}
const correctGuessers = {} // Track who guessed correctly per round

function startRoundTimer(roomId) {
  if (roundTimers[roomId]) clearTimeout(roundTimers[roomId])

  roundTimers[roomId] = setTimeout(() => {
    endRound(roomId)
  }, ROUND_TIMER)
}

// ✅ NEW: Handle player leaving mid-game
function handlePlayerLeft(userId) {
  // Find which room this player was in
  db.query(
    'SELECT room_id FROM room_players WHERE user_id = ?',
    [userId],
    (err, result) => {
      if (err || result.length === 0) return

      const roomId = result[0].room_id

      // Delete the player from room
      db.query('DELETE FROM room_players WHERE user_id = ?', [userId])

      // Check remaining players
      db.query(
        'SELECT COUNT(*) as cnt FROM room_players WHERE room_id = ?',
        [roomId],
        (err, rows) => {
          if (err) return

          const remainingPlayers = rows[0].cnt

          console.log(`⚠️ Player ${userId} left room ${roomId}. Remaining: ${remainingPlayers}`)

          // If 1 or fewer players left, end game
          if (remainingPlayers <= 1) {
            db.query(
              `UPDATE rooms SET game_status='finished' WHERE room_id=?`,
              [roomId]
            )

            // Get remaining player as winner
            db.query(
              `SELECT rp.user_id, u.username, rp.score FROM room_players rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ?`,
              [roomId],
              (err, scores) => {
                if (err || scores.length === 0) return

                const ranked = scores.map((p, i) => ({ ...p, rank: i + 1 }))
                const winner = ranked[0]

                console.log(`🏆 Player ${userId} left! ${winner.username} is the winner by default!`)
                io.to(roomId).emit('game-over', {
                  winner: {
                    user_id: winner.user_id,
                    username: winner.username,
                    score: winner.score,
                    rank: 1
                  },
                  leaderboard: ranked,
                  message: `🏆 ${winner.username} wins! Opponent(s) left the game.`
                })

                const gameOverCleanupDelay = (parseInt(process.env.GAME_OVER_CLEANUP_DELAY) || 3) * 1000
                setTimeout(() => {
                  db.query(
                    'SELECT user_id FROM room_players WHERE room_id = ?',
                    [roomId],
                    (err, players) => {
                      if (err) return

                      const userIds = players.map(p => p.user_id)

                      if (userIds.length > 0) {
                        db.query(`DELETE FROM users WHERE id IN (?)`, [userIds])
                      }

                      db.query('DELETE FROM guesses WHERE room_id = ?', [roomId])
                      db.query('DELETE FROM rounds WHERE room_id = ?', [roomId])
                      db.query('DELETE FROM room_players WHERE room_id = ?', [roomId])
                      db.query('DELETE FROM rooms WHERE room_id = ?', [roomId])
                    }
                  )
                }, gameOverCleanupDelay)
              }
            )
          } else {
            // Game continues with remaining players
            console.log(`✅ Game continues with ${remainingPlayers} players`)

            // Notify room that a player left
            io.to(roomId).emit('player-left', {
              message: `A player left the game. ${remainingPlayers} player(s) remaining.`,
              remainingPlayers
            })
          }
        }
      )
    }
  )
}

function endRound(roomId) {
  // Clear correct guessers for this round
  delete correctGuessers[roomId]

  // Auto‑start when at least PLAYERS env count have joined the room
  db.query('SELECT COUNT(*) as cnt FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
    if (!err && rows[0].cnt >= (parseInt(process.env.PLAYERS) || 2)) {
      io.to(roomId).emit('ready-to-start')
    }
  })
  db.query(`SELECT * FROM rooms WHERE room_id=?`, [roomId], (err, rows) => {
    if (err || rows.length === 0) return
    const room = rows[0]

    if (room.game_status !== 'playing') return

    io.to(roomId).emit('word-reveal', { word: room.current_word })

    db.query(
      `UPDATE rounds SET ended_at = NOW() WHERE room_id=? AND ended_at IS NULL`,
      [roomId]
    )

    db.query(
      `SELECT rp.user_id, u.username, u.profile 
FROM room_players rp
JOIN users u ON rp.user_id = u.id
WHERE rp.room_id=?
ORDER BY rp.joined_at ASC
`,
      [roomId],
      (err, players) => {
        if (err || players.length === 0) return

        const ids = players.map(p => p.user_id)
        const currentIndex = ids.indexOf(room.current_turn_user)
        const nextIndex = (currentIndex + 1) % ids.length
        const nextDrawer = ids[nextIndex]
        const nextPlayer = players[nextIndex]
        let newRound = room.current_round

        db.query(
          `SELECT rp.user_id, u.username, rp.score FROM room_players rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ? ORDER BY rp.score DESC`,
          [roomId],
          (err, scores) => {
            if (err) return
            const ranked = scores.map((p, i) => ({ ...p, rank: i + 1 }))
            io.to(roomId).emit('turn-complete', {
              scores: ranked,
              message: 'Turn over! Points update:',
              nextDrawer: {
                user_id: nextPlayer.user_id,
                username: nextPlayer.username,
                profile: nextPlayer.profile
              }
            })
          }
        )

        if (nextIndex === 0) {
          if (room.current_round >= room.total_rounds) {
            console.log(`✅ GAME OVER: Round ${room.current_round} >= Total ${room.total_rounds}`)
            db.query(
              `UPDATE rooms SET game_status='finished' WHERE room_id=?`,
              [roomId]
            )
            // Get scores for game over
            db.query(
              `SELECT rp.user_id, u.username, rp.score FROM room_players rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ? ORDER BY rp.score DESC`,
              [roomId],
              (err, scores) => {
                if (err) {
                  console.error('❌ Error getting scores:', err)
                  return
                }
                const ranked = scores.map((p, i) => ({ ...p, rank: i + 1 }))
                const winner = ranked[0]

                console.log(`🏆 Emitting game-over to room ${roomId}:`, winner.username)
                io.to(roomId).emit('game-over', {
                  winner: {
                    user_id: winner.user_id,
                    username: winner.username,
                    score: winner.score,
                    rank: 1
                  },
                  leaderboard: ranked,
                  totalRounds: room.total_rounds,
                  message: `🏆 ${winner.username} wins the game!`
                })

                const gameOverCleanupDelay = (parseInt(process.env.GAME_OVER_CLEANUP_DELAY) || 3) * 1000
                setTimeout(() => {

                  db.query(
                    'SELECT user_id FROM room_players WHERE room_id = ?',
                    [roomId],
                    (err, players) => {
                      if (err) return

                      const userIds = players.map(p => p.user_id)

                      if (userIds.length > 0) {
                        db.query(`DELETE FROM users WHERE id IN (?)`, [userIds])
                      }

                      db.query('DELETE FROM guesses WHERE room_id = ?', [
                        roomId
                      ])
                      db.query('DELETE FROM rounds WHERE room_id = ?', [roomId])
                      db.query('DELETE FROM room_players WHERE room_id = ?', [
                        roomId
                      ])
                      db.query('DELETE FROM rooms WHERE room_id = ?', [roomId])
                    }
                  )
                }, gameOverCleanupDelay)
              }
            )
            return
          }

          io.to(roomId).emit('round-complete', { round: room.current_round })
          newRound = room.current_round + 1
        }

        setTimeout(() => {
          db.query(
            `UPDATE rooms SET current_round = ?, current_turn_user = ?, current_word = NULL, game_status = 'waiting' WHERE room_id = ?`,
            [newRound, nextDrawer, roomId]
          )

          io.to(roomId).emit('next-round', {
            drawerId: nextDrawer,
            round: newRound
          })

          io.to(roomId).emit('clear-canvas')
          io.to(roomId).emit('reset-guesses')
        }, constants.GAME.PRE_GAME_COUNTDOWN * 1000)
      }
    )
  })
}

io.on('connection', socket => {
  socket.on('new-user-online', userId => {
    if (!userId) return

    db.query(
      'UPDATE users SET socket_id = ? WHERE id = ?',
      [socket.id, userId],
      err => {
        if (err) return console.log('❌ DB error:', err)

        io.emit('refresh-players')
      }
    )
  })

  socket.on('disconnect', () => {
    db.query(
      'SELECT id, status FROM users WHERE socket_id = ?',
      [socket.id],
      (err, users) => {
        if (err || users.length === 0) return

        const userId = users[0].id
        const userStatus = users[0].status

        // ✅ If user was in a room (game in progress), handle them leaving
        if (userStatus === 'rooms') {
          handlePlayerLeft(userId)
          return
        }

        // Only delete if user is 'online' (not in room)
        db.query('DELETE FROM users WHERE id = ?', [userId])

        db.query(`
        DELETE FROM rooms 
        WHERE room_id NOT IN (
          SELECT DISTINCT room_id FROM room_players
        )
      `)

        io.emit('refresh-players')
      }
    )
  })

  socket.on('join-room', roomId => {
    socket.join(roomId)

    // Auto‑start when at least PLAYERS env count have joined the room
    db.query('SELECT COUNT(*) as cnt FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
      if (!err && rows[0].cnt >= (parseInt(process.env.PLAYERS) || 2)) {
        io.to(roomId).emit('ready-to-start')
      }
    })

    const q = `
      SELECT u.socket_id
      FROM rooms r
      JOIN users u ON u.id = r.current_turn_user
      WHERE r.room_id = ?
    `

    db.query(q, [roomId], (err, rows) => {
      if (rows.length === 0) return
      const shuffled = [...WORDS].sort(() => 0.5 - Math.random())
      io.to(rows[0].socket_id).emit('choose-word', shuffled.slice(0, 3))
    })
  })

  socket.on('request-words', ({ roomId }) => {
    const shuffled = [...WORDS].sort(() => 0.5 - Math.random())
    socket.emit('choose-word', shuffled.slice(0, 3))
  })

  socket.on('select-word', ({ roomId, userId, word }) => {
    const roundEndTime = Date.now() + ROUND_TIME * 1000

    db.query(
      `SELECT current_round FROM rooms WHERE room_id=?`,
      [roomId],
      (err, rows) => {
        const current_round = rows[0].current_round

        db.query(
          `INSERT INTO rounds (room_id, round_no, drawer_user_id, word, started_at) VALUES (?, ?, ?, ?, NOW())`,
          [roomId, current_round, userId, word]
        )

        db.query(
          `UPDATE rooms SET current_word=?, current_turn_user=?, game_status='playing', round_start_time=NOW(), round_end_time=? WHERE room_id=?`,
          [word, userId, roundEndTime, roomId]
        )

        socket.emit('word-confirmed', { word })
        socket.to(roomId).emit('word-selected')
        io.to(roomId).emit('round-start', {
          roundEndTime,
          duration: ROUND_TIME
        })

        startRoundTimer(roomId)
      }
    )
  })

  socket.on('guess', ({ roomId, userId, guess, username, userprofile }) => {
    db.query(
      `SELECT current_word, current_turn_user, round_end_time FROM rooms WHERE room_id=?`,
      [roomId],
      (err, rows) => {
        if (err || rows.length === 0) return
        const word = rows[0].current_word
        const drawerId = rows[0].current_turn_user
        const is_correct = guess.toLowerCase() === word.toLowerCase()
        const remaining = Math.max(
          0,
          Math.ceil((rows[0].round_end_time - Date.now()) / 1000)
        )
        let points = is_correct ? remaining : 0

        // ✅ Don't insert correct guesses into DB (they're special)
        if (!is_correct) {
          db.query(
            `SELECT id FROM rounds WHERE room_id=? ORDER BY id DESC LIMIT 1`,
            [roomId],
            (err, r) => {
              const round_id = r[0]?.id || 0
              db.query(
                `INSERT INTO guesses (room_id, round_id, user_id, guess_text, is_correct, guessed_at) VALUES (?, ?, ?, ?, ?, NOW())`,
                [roomId, round_id, userId, guess, is_correct]
              )
            }
          )

          // Broadcast wrong guess
          io.to(roomId).emit('new-guess', { username, guess, is_correct, profile: userprofile })
        } else {
          // ✅ CORRECT GUESS - Show as special green message, don't end round yet
          if (!correctGuessers[roomId]) {
            correctGuessers[roomId] = new Set()
          }

          // Add this user to correct guessers
          correctGuessers[roomId].add(userId)

          console.log(`✅ ${username} guessed correctly! Word: ${word}`)

          // Award points
          db.query(
            `UPDATE room_players SET score = score + ? WHERE room_id=? AND user_id=?`,
            [points, roomId, userId]
          )

          // Broadcast as correct guess (green message, not regular guess)
          io.to(roomId).emit('correct-guess', {
            username,
            word,
            points,
            profile: userprofile,
            userId
          })
          io.to(roomId).emit('score-update', { userId, points })

          // Check if all non-drawer players have guessed correctly
          db.query(
            `SELECT COUNT(DISTINCT user_id) as total FROM room_players WHERE room_id=? AND user_id != ?`,
            [roomId, drawerId],
            (err, result) => {
              if (err || !result) return

              const totalNonDrawers = result[0].total
              const correctCount = correctGuessers[roomId].size

              console.log(`📊 Correct guesses: ${correctCount}/${totalNonDrawers}`)

              // End round if all non-drawer players guessed correctly
              if (correctCount >= totalNonDrawers) {
                console.log(`🏁 All players guessed correctly! Ending round...`)
                if (roundTimers[roomId]) clearTimeout(roundTimers[roomId])
                endRound(roomId)
              }
            }
          )
        }
      }
    )
  })

  socket.on('draw', ({ roomId, stroke }) => {
    socket.to(roomId).emit('draw', { stroke })
  })

  socket.on('undo', ({ roomId }) => {
    socket.to(roomId).emit('undo')
  })

  socket.on('clear-canvas', ({ roomId }) => {
    socket.to(roomId).emit('clear-canvas')
  })

  socket.on('redo', ({ roomId }) => {
    socket.to(roomId).emit('redo')
  })

  socket.on('eraseMode', ({ roomId, value }) => {
    socket.to(roomId).emit('eraseMode', { value })
  })

  // ✅ Reconnection handler - restore user socket_id
  socket.on('user-reconnect', userId => {
    if (!userId) return

    db.query(
      'UPDATE users SET socket_id = ? WHERE id = ?',
      [socket.id, userId],
      err => {
        if (err) return console.log('❌ Reconnect DB error:', err)

        console.log(`✅ User ${userId} reconnected with socket ${socket.id}`)
        io.emit('refresh-players')
      }
    )
  })
})

app.use('/api/auth', loginRoutes(io))
app.use('/api/play', playRoutes(io))

app.get('/', (req, res) => {
  res.json({
    status: 1,
    server: 'running',
    db: isDBConnected ? 'connected' : 'not connected',
    environment: constants.SERVER.NODE_ENV
  })
})

// ✅ Performance metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    status: 1,
    metrics: PerformanceMonitor.getMetrics(),
    server: {
      port: constants.SERVER.PORT,
      environment: constants.SERVER.NODE_ENV
    },
    game: {
      players: constants.GAME.PLAYERS,
      rounds: constants.GAME.TOTAL_ROUNDS,
      roundTime: constants.GAME.ROUND_TIME
    }
  })
})

// Error handling middleware
app.use(errorHandler)

server.listen(constants.SERVER.PORT, () => {
  console.log(`✅ Server + Socket.IO @ http://localhost:${constants.SERVER.PORT}`)
  console.log(`🎮 Game Config: ${constants.GAME.PLAYERS} players, ${constants.GAME.TOTAL_ROUNDS} rounds`)
  console.log(`📊 Metrics available at: http://localhost:${constants.SERVER.PORT}/api/metrics`)
})
