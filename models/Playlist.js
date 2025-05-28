const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String,
  description: String,
  songs: [{
    title: String,
    artist: String,
    album: String,
    spotifyId: String,
    imageUrl: String
  }]
});

module.exports = mongoose.model("Playlist", playlistSchema);
