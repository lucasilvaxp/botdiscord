const { Collection } = require('discord.js');

class QueueManager {
    constructor() {
        // Armazena as filas por ID da mensagem ou por chave de modo
        // Estrutura: { mode: '2v2', players: Set<userId>, messageId: string, channelId: string }
        this.queues = new Collection();
        
        // Configurações de modos
        this.modes = {
            '1v1': { playersNeeded: 2, label: '1v1' },
            '2v2': { playersNeeded: 4, label: '2v2' },
            '3v3': { playersNeeded: 6, label: '3v3' },
            '4v4': { playersNeeded: 8, label: '4v4' }
        };

        // Armazena partidas ativas
        // Estrutura: { matchId, mode, team1, team2, captain1, captain2, categoryId, textChannelId, voice1Id, voice2Id, winnerPending: { winner, proposerId } }
        this.activeMatches = new Collection();
    }

    /**
     * Registra uma partida ativa.
     */
    createMatch(matchData) {
        this.activeMatches.set(matchData.textChannelId, matchData);
    }

    /**
     * Retorna uma partida ativa pelo ID do canal de texto.
     */
    getMatch(channelId) {
        return this.activeMatches.get(channelId);
    }

    /**
     * Remove uma partida ativa.
     */
    deleteMatch(channelId) {
        this.activeMatches.delete(channelId);
    }

    /**
     * Cria uma nova fila.
     * @param {string} mode - O modo da fila (2v2, 3v3, 4v4).
     * @param {string} messageId - ID da mensagem da embed.
     * @param {string} channelId - ID do canal onde a fila foi aberta.
     */
    createQueue(mode, messageId, channelId) {
        this.queues.set(messageId, {
            mode,
            players: new Set(),
            messageId,
            channelId,
            config: this.modes[mode]
        });
    }

    /**
     * Adiciona um jogador à fila.
     * @param {string} messageId - ID da mensagem da fila.
     * @param {string} userId - ID do usuário.
     * @returns {boolean} - Se o jogador foi adicionado.
     */
    addPlayer(messageId, userId) {
        const queue = this.queues.get(messageId);
        if (!queue) return false;
        
        if (queue.players.has(userId)) return false;
        
        queue.players.add(userId);
        return true;
    }

    /**
     * Remove um jogador da fila.
     * @param {string} messageId - ID da mensagem da fila.
     * @param {string} userId - ID do usuário.
     * @returns {boolean} - Se o jogador foi removido.
     */
    removePlayer(messageId, userId) {
        const queue = this.queues.get(messageId);
        if (!queue || !queue.players.has(userId)) return false;
        
        queue.players.delete(userId);
        return true;
    }

    /**
     * Verifica se a fila está cheia.
     * @param {string} messageId - ID da mensagem da fila.
     * @returns {boolean} - Se a fila atingiu o limite.
     */
    isFull(messageId) {
        const queue = this.queues.get(messageId);
        if (!queue) return false;
        return queue.players.size >= queue.config.playersNeeded;
    }

    /**
     * Retorna os dados da fila.
     * @param {string} messageId - ID da mensagem da fila.
     */
    getQueue(messageId) {
        return this.queues.get(messageId);
    }

    /**
     * Remove uma fila.
     * @param {string} messageId - ID da mensagem da fila.
     */
    deleteQueue(messageId) {
        this.queues.delete(messageId);
    }
}

module.exports = new QueueManager();
