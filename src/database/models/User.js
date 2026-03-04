const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    points: { type: Number, default: 1000 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    mvps: { type: Number, default: 0 },
    totalMatches: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastMatchDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
