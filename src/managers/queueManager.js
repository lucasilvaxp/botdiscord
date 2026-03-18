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
            players: [], // Array para manter a ordem de entrada
            team1: [],   // Para desafios
            team2: [],   // Para desafios
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
