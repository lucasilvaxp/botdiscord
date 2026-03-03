/**
 * Implementação do algoritmo de Fisher-Yates para embaralhar um array.
 * @param {Array} array - O array a ser embaralhado.
 * @returns {Array} - O array embaralhado.
 */
function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Divide os jogadores em dois times.
 * @param {Array} players - Lista de IDs de jogadores.
 * @returns {Object} - Objeto contendo time1 e time2.
 */
function createTeams(players) {
    const shuffledPlayers = shuffle(players);
    const half = Math.ceil(shuffledPlayers.length / 2);
    
    return {
        team1: shuffledPlayers.slice(0, half),
        team2: shuffledPlayers.slice(half)
    };
}

module.exports = { shuffle, createTeams };
