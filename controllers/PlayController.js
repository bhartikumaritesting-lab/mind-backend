const db = require('../config/db')

exports.GetPlayerRoom = (req, res) => {
  const { roomId } = req.body
  const roomQuery = `SELECT * FROM rooms WHERE room_id = ?`
  const playersQuery = `
  SELECT 
    rp.user_id,
    u.username,
    u.profile,
    rp.score,
    rp.is_drawer
  FROM room_players rp
  JOIN users u ON u.id = rp.user_id
  WHERE rp.room_id = ?
`

  db.query(roomQuery, [roomId], (err, roomResult) => {
    if (err || roomResult.length === 0)
      return res.status(404).json({ status: 0, message: 'Room not found' })

    db.query(playersQuery, [roomId], (pErr, players) => {
      if (pErr) players = [] // agar error aaye toh empty array

      return res.status(200).json({
        status: 1,
        message: 'Room fetched successfully',
        room: roomResult[0],
        players
      })
    })
  })
}

exports.StartGame = io => (req, res) => {
  const { roomId } = req.body
  const q = `SELECT rp.user_id, u.username, u.profile, rp.score FROM room_players rp JOIN users u ON u.id = rp.user_id WHERE room_id=? ORDER BY joined_at ASC`

  db.query(q, [roomId], (err, players) => {
    if (err || players.length < 2) return res.json({ status: 0 })
    const drawerId = players[0].user_id

    io.to(roomId).emit('pre-game-start', { players })

    setTimeout(() => {
      db.query(
        "UPDATE rooms SET game_status='playing', current_turn_user=?, total_rounds=3, current_round=1 WHERE room_id=?",
        [drawerId, roomId]
      )
      io.to(roomId).emit('game-start', { drawerId })
    }, 10000)

    res.json({ status: 1 })
  })
}

exports.GetRoomState = (req, res) => {
  const { roomId, userId } = req.body

  db.query(
    `SELECT current_word, current_turn_user, game_status, current_round, total_rounds 
     FROM rooms WHERE room_id=?`,
    [roomId],
    (err, result) => {
      if (err || result.length === 0) {
        return res.json({ status: 0 })
      }

      const room = result[0]

      if (!room.current_word) {
        return res.json({
          status: 1,
          role: room.current_turn_user == userId ? 'drawer' : 'guesser',
          word: null,
          message: 'Waiting for word selection',
          current_round: room.current_round,
          total_rounds: room.total_rounds
        })
      }

      if (room.current_turn_user == userId) {
        return res.json({
          status: 1,
          role: 'drawer',
          word: room.current_word,
          current_round: room.current_round,
          total_rounds: room.total_rounds
        })
      }

      return res.json({
        status: 1,
        role: 'guesser',
        word: '_ '.repeat(room.current_word.length),
        current_round: room.current_round,
        total_rounds: room.total_rounds
      })
    }
  )
}

