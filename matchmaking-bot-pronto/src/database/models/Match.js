const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true },
    mode: { type: String, required: true },
    team1: [String],
    team2: [String],
    winner: { type: String },
    mvp: { type: String },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
