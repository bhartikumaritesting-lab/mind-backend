const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");

router.post("/connect", AuthController.Connect);
router.post("/getingplayers", AuthController.GetingPlayers);
router.post("/startplay", AuthController.StartPlay);
router.post("/joinroom", AuthController.JoinRoom);
router.post("/GetUserStatus", AuthController.GetUserStatus);

module.exports = router;
