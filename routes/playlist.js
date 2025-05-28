const express = require("express");
const Playlist = require("../models/Playlist");
const jwt = require("jsonwebtoken");

const router = express.Router();

// JWT middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).send("No token provided");
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send("Unauthorized");
    req.userId = decoded.id;
    next();
  });
};

router.get("/playlists", verifyToken, async (req, res) => {
  const playlists = await Playlist.find({ userId: req.userId });
  res.json(playlists);
});

router.post("/playlists", verifyToken, async (req, res) => {
  const playlist = new Playlist({ ...req.body, userId: req.userId });
  await playlist.save();
  res.status(201).json(playlist);
});

router.put("/playlists/:id", verifyToken, async (req, res) => {
  const updated = await Playlist.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

router.delete("/playlists/:id", verifyToken, async (req, res) => {
  await Playlist.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

module.exports = router;
