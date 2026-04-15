const express = require('express')
const router = express.Router()
const PlayController = require('../controllers/PlayController')

module.exports = io => {
  router.post('/getplayerroom', PlayController.GetPlayerRoom)
  router.post('/startgame', PlayController.StartGame(io))
  router.post('/getRoomState', PlayController.GetRoomState)
  
  return router
}
