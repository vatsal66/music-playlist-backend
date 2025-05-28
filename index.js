const axios = require("axios");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const User = require("./models/User");
const Playlist = require("./models/Playlist");

const app = express();
app.use(cors());
app.use(express.json());

let spotifyToken = null;
let tokenExpiresAt = 0;

const getSpotifyToken = async () => {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiresAt) return spotifyToken;

  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  spotifyToken = res.data.access_token;
  tokenExpiresAt = now + res.data.expires_in * 1000;
  return spotifyToken;
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).send("No token provided");
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send("Unauthorized");
    req.userId = decoded.id;
    next();
  });
};

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword });
  await user.save();
  res.status(201).send("User registered");
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).send("Invalid credentials");
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

app.get("/api/playlists", verifyToken, async (req, res) => {
  const playlists = await Playlist.find({ userId: req.userId });
  res.json(playlists);
});

app.post("/api/playlists", verifyToken, async (req, res) => {
  const playlist = new Playlist({ ...req.body, userId: req.userId });
  await playlist.save();
  res.status(201).json(playlist);
});

app.put("/api/playlists/:id", verifyToken, async (req, res) => {
  const updated = await Playlist.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete("/api/playlists/:id", verifyToken, async (req, res) => {
  await Playlist.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

app.get("/api/spotify/search", verifyToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });

  try {
    const token = await getSpotifyToken();
    const result = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        q,
        type: "track",
        limit: 10,
      },
    });

    const tracks = result.data.tracks.items.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0]?.name,
      album: track.album.name,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error("Spotify search error:", err.message);
    res.status(500).json({ error: "Spotify search failed" });
  }
});

app.post("/api/playlists/:id/songs", verifyToken, async (req, res) => {
  const playlistId = req.params.id;
  const song = req.body;

  try {
    const playlist = await Playlist.findOne({ _id: playlistId, userId: req.userId });
    if (!playlist) return res.status(404).send("Playlist not found");

    // Add song to songs array
    playlist.songs.push(song);
    await playlist.save();

    res.status(200).json({ message: "Song added to playlist", playlist });
  } catch (error) {
    console.error("Error adding song:", error);
    res.status(500).send("Internal Server Error");
  }
});



app.listen(5000, () => console.log("Server started on port 5000"));