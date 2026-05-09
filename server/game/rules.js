/**
 * Game rules module - Utilities for game logic
 */

/**
 * Get legal moves for current game state
 * @param {ReversiGame} game - Game instance
 * @returns {Array<[number, number]>} Array of legal move coordinates
 */
function getLegalMoves(game) {
  if (!game || game.isFinished) {
    return [];
  }
  return game.getLegalMoves();
}

/**
 * Validate if a move is legal
 * @param {ReversiGame} game - Game instance
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {boolean}
 */
function isLegalMove(game, row, col) {
  if (!game || game.isFinished) {
    return false;
  }
  return game.isValidMove(row, col);
}

/**
 * Get game score
 * @param {ReversiGame} game - Game instance
 * @returns {Object} { black: number, white: number }
 */
function getScore(game) {
  if (!game) {
    return { black: 0, white: 0 };
  }
  return {
    black: game.countPieces(1),
    white: game.countPieces(2)
  };
}

/**
 * Determine if game is finished
 * @param {ReversiGame} game - Game instance
 * @returns {boolean}
 */
function isGameFinished(game) {
  return !game || game.isFinished;
}

module.exports = {
  getLegalMoves,
  isLegalMove,
  getScore,
  isGameFinished
};
