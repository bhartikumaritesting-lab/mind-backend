const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");

module.exports = io => {
  router.post("/connect", AuthController.Connect);
  router.post("/getingplayers", AuthController.GetingPlayers);
  router.post("/startplay", AuthController.StartPlay);
  router.post("/joinroom", AuthController.JoinRoom(io));
  router.post("/GetUserStatus", AuthController.GetUserStatus);

  return router;
};
