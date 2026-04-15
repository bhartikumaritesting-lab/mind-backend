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

dotenv.config()
const PORT = process.env.PORT || 3001

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
  'apple',
  'banana',
  'orange',
  'grape',
  'strawberry',
  'car',
  'bicycle',
  'airplane',
  'boat',
  'train',
  'dog',
  'cat',
  'elephant',
  'lion',
  'giraffe',
  'house',
  'apartment',
  'castle',
  'igloo',
  'tent',
  'computer',
  'phone',
  'television',
  'camera',
  'clock',
  'doctor',
  'teacher',
  'firefighter',
  'police',
  'chef',
  'pizza',
  'hamburger',
  'spaghetti',
  'sushi',
  'salad',
  'guitar',
  'piano',
  'drums',
  'violin',
  'trumpet',
  'basketball',
  'soccer',
  'tennis',
  'golf',
  'swimming',
  'sun',
  'moon',
  'star',
  'cloud',
  'rainbow'
]

const ROUND_TIME = process.env.ROUND_TIME || 120
const roundTimers = {}
const ROUND_TIMER = ROUND_TIME * 1000

function startRoundTimer (roomId) {
  if (roundTimers[roomId]) clearTimeout(roundTimers[roomId])

  roundTimers[roomId] = setTimeout(() => {
    endRound(roomId)
  }, ROUND_TIMER)
}

function endRound (roomId) {
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
            db.query(
              `UPDATE rooms SET game_status='finished' WHERE room_id=?`,
              [roomId]
            )
            // Get scores for game over
            db.query(
              `SELECT rp.user_id, u.username, rp.score FROM room_players rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ? ORDER BY rp.score DESC`,
              [roomId],
              (err, scores) => {
                if (err) return
                const ranked = scores.map((p, i) => ({ ...p, rank: i + 1 }))
                const winner = ranked[0]

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
                }, 3000)
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
        }, 10000)
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
    const getUserQuery = 'SELECT id, socket_id FROM users WHERE socket_id = ?'
    db.query(getUserQuery, [socket.id], (err, users) => {
      if (err || users.length === 0) return

      const userId = users[0].id

      db.query('UPDATE users SET socket_id = NULL WHERE id = ?', [userId])

      const getRoomsQuery = `
      SELECT room_id, current_turn_user
      FROM room_players rp
      JOIN rooms r ON r.room_id = rp.room_id
      WHERE rp.user_id = ?
    `

      db.query(getRoomsQuery, [userId], (err, rooms) => {
        if (err) return

        rooms.forEach(r => {
          const roomId = r.room_id
          const isDrawer = r.current_turn_user === userId

          db.query(
            'DELETE FROM room_players WHERE room_id = ? AND user_id = ?',
            [roomId, userId]
          )

          db.query(
            'SELECT user_id FROM room_players WHERE room_id = ? ORDER BY id ASC',
            [roomId],
            (err, players) => {
              if (err || players.length === 0) {
                db.query('DELETE FROM rooms WHERE room_id = ?', [roomId])
                return
              }

              if (isDrawer) {
                const nextDrawer = players[0].user_id
                db.query(
                  'UPDATE rooms SET current_turn_user = ? WHERE room_id = ?',
                  [nextDrawer, roomId],
                  () => {
                    io.to(roomId).emit('next-round', { drawerId: nextDrawer })
                  }
                )
              }
            }
          )
        })

        io.emit('refresh-players')
      })
    })
  })

  socket.on('join-room', roomId => {
    socket.join(roomId)

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

  socket.on('guess', ({ roomId, userId, guess, username }) => {
    db.query(
      `SELECT current_word, round_end_time FROM rooms WHERE room_id=?`,
      [roomId],
      (err, rows) => {
        if (err || rows.length === 0) return
        const word = rows[0].current_word
        const is_correct = guess.toLowerCase() === word.toLowerCase()
        const remaining = Math.max(
          0,
          Math.ceil((rows[0].round_end_time - Date.now()) / 1000)
        )
        let points = is_correct ? remaining : 0

        db.query(
          `SELECT id FROM rounds WHERE room_id=? ORDER BY id DESC LIMIT 1`,
          [roomId],
          (err, r) => {
            const round_id = r[0]?.id || 0
            db.query(
              `INSERT INTO guesses (room_id, round_id, user_id, guess_text, is_correct, guessed_at) VALUES (?, ?, ?, ?, ?, NOW())`,
              [roomId, round_id, userId, guess, is_correct]
            )

            if (is_correct) {
              db.query(
                `UPDATE room_players SET score = score + ? WHERE room_id=? AND user_id=?`,
                [points, roomId, userId]
              )
              io.to(roomId).emit('score-update', { userId, points })

              if (roundTimers[roomId]) clearTimeout(roundTimers[roomId])
              endRound(roomId)
            } else {
              io.to(roomId).emit('new-guess', { username, guess, is_correct })
            }
          }
        )
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
})

app.use('/api/auth', loginRoutes)
app.use('/api/play', playRoutes(io))

app.get('/', (req, res) => {
  res.send('🚀 Server is running!')
})

server.listen(PORT, () => {
  console.log(`✅ Server + Socket.IO @ http://localhost:${PORT}`)
})
