const { Collection } = require('discord.js');

class QueueManager {
    constructor() {
        this.queues = new Collection();
        this.activeMatches = new Collection();
    }

    createQueue(mode, messageId, channelId) {
        this.queues.set(messageId, {
            mode,
            messageId,
            channelId,
            players: [],
            team1: [],
            team2: [],
            ownerId: null,
            maxPlayers: 0,
            teamSize: 0,
            isChallenge: false,
            createdAt: new Date()
        });
    }

    getQueue(messageId) {
        return this.queues.get(messageId);
    }

    deleteQueue(messageId) {
        this.queues.delete(messageId);
    }

    createMatch(matchData) {
        // matchData deve conter: matchId, textChannelId, ownerId, team1, team2, categoryId, players
        this.activeMatches.set(matchData.textChannelId, matchData);
    }

    getMatch(channelId) {
        return this.activeMatches.get(channelId);
    }

    deleteMatch(channelId) {
        this.activeMatches.delete(channelId);
    }
}

module.exports = new QueueManager();
