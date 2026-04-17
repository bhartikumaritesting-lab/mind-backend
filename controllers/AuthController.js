const db = require('../config/db')

exports.Connect = (req, res) => {
  const { name, language, country, selectedAvatar } = req.body

  const insertQuery =
    'INSERT INTO `users`( `username`, `language`, `country`, `status`, `profile`) VALUES (?, ?, ?, ?, ?)'

  db.query(
    insertQuery,
    [name, language.value, country.value, 'online', selectedAvatar],
    function (error, result) {
      if (error) {
        console.log(error)
        return res.status(200).json({ status: 2, message: 'Database Error.' })
      }

      const insertedUserId = result.insertId
      const insertedUserName = name

      res.status(200).json({
        status: 1,
        message: `${name} profile created successfully.`,
        userId: insertedUserId,
        username: insertedUserName,
        profile: selectedAvatar
      })
    }
  )
}

exports.StartPlay = (req, res) => {
  console.log(req.body)

  const players = req.body.players
  const playerIds = players.map(p => p.id) // [64, 65, 66]
  const playerString = playerIds.join(',') // "64,65,66"

  const insertSql = 'INSERT INTO `rooms` (`player`, `craeted_at`) VALUES (?, ?)'

  db.query(insertSql, [playerString, new Date()], (err, result) => {
    if (err) {
      console.error('Insert Error:', err)
      return res.status(500).json({ message: 'Insert DB Error' })
    }

    const updateSql = "UPDATE `users` SET `status` = 'rooms' WHERE `id` IN (?)"

    db.query(updateSql, [playerIds], (err2, result2) => {
      if (err2) {
        console.error('Update Error:', err2)
        return res.status(500).json({ message: 'Update DB Error' })
      }

      res.status(200).json({
        status: 1,
        message: 'Players inserted as single row and users updated',
        inserted: result.affectedRows,
        updated: result2.affectedRows
      })
    })
  })
}

exports.GetingPlayers = (req, res) => {
  let { country, userId } = req.body

  if (typeof country === 'object' && country !== null) {
    country = country.value
  }

  // 🎮 Get 2 other online users (so total 3 = PLAYERS env)
  const SelectQuery = `
    SELECT * 
    FROM users 
    WHERE country = ? 
      AND status = 'online' 
      AND id != ?
    ORDER BY id DESC LIMIT 2
  `

  db.query(SelectQuery, [country, userId], (error, result) => {
    if (error) {
      console.log('DB Error:', error)
      return res.status(200).json({ status: 2, message: 'Database Error.' })
    }

    // ✅ If 2 other players found (total 3)
    if (result.length === 2) {
      const allPlayerIds = [userId, ...result.map(p => p.id)]
      console.log(`🎮 3 Players Found! IDs: ${allPlayerIds.join(', ')}`)
      
      return res.status(200).json({
        status: 3,
        message: '3 Players found! Game starting...',
        data: result,
        playerIds: allPlayerIds,
        player: userId,
        totalPlayers: 3
      })
    }

    // ⏳ If only 1 player found (total 2)
    if (result.length === 1) {
      return res.status(200).json({
        status: 2,
        message: 'Only 1 opponent found. Waiting for 1 more...',
        data: result,
        foundPlayers: 1,
        neededPlayers: 1
      })
    }

    // 🔍 No players found yet
    return res.status(200).json({
      status: 1,
      message: 'Searching for opponents...',
      data: []
    })
  })
}

exports.JoinRoom = io => {
  return (req, res) => {
    const { playerIds } = req.body

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(200).json({ status: 0, message: 'No players received' })
    }

    const sortedIds = [...new Set(playerIds)].sort((a, b) => a - b)
    const roomKey = sortedIds.join('_')
    const createdAt = new Date()

    // STEP 0: any user already in room?
    const checkExisting = `
      SELECT user_id FROM room_players WHERE user_id IN (?)
    `

    db.query(checkExisting, [sortedIds], (err, exist) => {
      if (err) return res.json({ status: 2, message: 'DB error' })

      if (exist.length > 0) {
        return res.json({
          status: 4,
          message: 'User already in room',
          users: exist
        })
      }

      // STEP 1: Create OR fetch room
      const roomQuery = `
        INSERT INTO rooms (room_key, max_players, created_at, game_status)
        VALUES (?, ?, ?, 'waiting')
        ON DUPLICATE KEY UPDATE room_id = LAST_INSERT_ID(room_id)
      `

      db.query(
        roomQuery,
        [roomKey, sortedIds.length, createdAt],
        (roomErr, roomRes) => {
          if (roomErr) {
            console.error('❌ Room error:', roomErr)
            return res.json({ status: 2, message: 'Room error' })
          }

          const roomId = roomRes.insertId

          // STEP 2: insert players (unique(user_id) handles safety)
          const rpValues = sortedIds.map(uid => [roomId, uid, 0, 0, createdAt])

          const rpQuery = `
            INSERT IGNORE INTO room_players
            (room_id, user_id, score, is_drawer, joined_at)
            VALUES ?
          `

          db.query(rpQuery, [rpValues], rpErr => {
            if (rpErr) {
              console.error('❌ room_players error:', rpErr)
              return res.json({ status: 2, message: 'Player insert failed' })
            }

            // STEP 3: update user status
            const placeholders = sortedIds.map(() => '?').join(',')
            db.query(
              `UPDATE users SET status='rooms' WHERE id IN (${placeholders})`,
              sortedIds
            )

            // ✅ STEP 4: Get all socket IDs and broadcast ready-to-start to ALL players
            db.query(
              `SELECT id, socket_id FROM users WHERE id IN (${placeholders})`,
              sortedIds,
              (err, users) => {
                if (!err && users.length > 0) {
                  console.log(`🎮 Broadcasting ready-to-start to room ${roomId}:`)
                  users.forEach(user => {
                    if (user.socket_id) {
                      console.log(`   → User ${user.id} (socket: ${user.socket_id})`)
                      // Emit directly to each user's socket
                      io.to(user.socket_id).emit('ready-to-start', {
                        roomId,
                        message: '🎮 Game room ready! Redirecting...',
                        totalPlayers: sortedIds.length
                      })
                    }
                  })
                }
              }
            )

            return res.json({
              status: 1,
              message: 'Room joined successfully',
              room_id: roomId,
              players: sortedIds
            })
          })
        }
      )
    })
  }
}

exports.GetUserStatus = (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(200).json({ status: 0, message: 'userId missing' })
  }

  const query = `
    SELECT status 
    FROM users 
    WHERE id = ?
  `

  db.query(query, [userId], (error, result) => {
    if (error) {
      console.log('DB Error in GetUserStatus:', error)
      return res.status(200).json({ status: 2, message: 'Database Error' })
    }

    if (result.length === 0) {
      return res.status(200).json({ status: 0, message: 'User not found' })
    }

    return res.status(200).json({
      status: 1,
      data: result[0].status // e.g., 'online', 'rooms', etc.
    })
  })
}
