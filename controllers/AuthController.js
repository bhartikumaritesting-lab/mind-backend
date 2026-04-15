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
        username: insertedUserName
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

  // Exclude self, get newest 1 other online user in country
  const SelectQuery = `
    SELECT * 
    FROM users 
    WHERE country = ? 
      AND status = 'online' 
      AND id != ?
    ORDER BY id DESC LIMIT 1
  `

  db.query(SelectQuery, [country, userId], (error, result) => {
    if (error) {
      console.log('DB Error:', error)
      return res.status(200).json({ status: 2, message: 'Database Error.' })
    }

    if (result.length > 0) {
      const ids = result.map(p => p.id)
      return res.status(200).json({
        status: 3,
        message: 'Opponent found',
        data: result,
        playerIds: ids,
        player: userId
      })
    }

    return res.status(200).json({
      status: 1,
      data: []
    })
  })
}

exports.JoinRoom = (req, res) => {
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

    // STEP 1: Create OR fetch room (🔥 main fix)
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

        const roomId = roomRes.insertId // 👈 works for both new & existing

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
