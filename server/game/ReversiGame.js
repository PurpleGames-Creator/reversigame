/**
 * ReversiGame - Reversi/Othello game logic
 *
 * Manages:
 * - 8x8 game board state
 * - Player turns (black and white)
 * - Move validation and piece flipping
 * - Game status and winner determination
 * - Turn timeout and auto-move functionality
 */

// Timeout configuration (20 seconds)
const TURN_TIME_LIMIT = 20000;

class ReversiGame {
  constructor(host, guest) {
    this.host = host;
    this.guest = guest;

    // Assign colors: host is black (first player), guest is white
    this.blackPlayer = host;
    this.whitePlayer = guest;
    this.currentPlayer = 'black';

    // Initialize board: 0 = empty, 1 = black, 2 = white
    this.board = this.initializeBoard();

    // Game status
    this.status = 'playing';
    this.winner = null;
    this.isFinished = false;

    // Timeout management
    this.turnStartTime = null;
    this.turnDeadline = null;
    this.turnTimeoutId = null;
  }

  /**
   * Initialize the board with starting position
   * Black in center-left and top-right, White in center-right and bottom-left
   */
  initializeBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));

    // Starting position
    board[3][3] = 2; // white
    board[3][4] = 1; // black
    board[4][3] = 1; // black
    board[4][4] = 2; // white

    return board;
  }

  /**
   * Make a move at the specified position
   * @param {number} row - Row index (0-7)
   * @param {number} col - Column index (0-7)
   * @throws {Error} If move is invalid
   */
  move(row, col) {
    if (!this.isValidMove(row, col)) {
      throw new Error(`Invalid move at [${row}, ${col}]`);
    }

    const playerColor = this.currentPlayer === 'black' ? 1 : 2;
    this.board[row][col] = playerColor;

    // Flip opponent pieces in all directions
    this.flipPieces(row, col, playerColor);

    // Switch player
    this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';

    // Check if game is finished
    this.checkGameStatus();
  }

  /**
   * Check if a move is valid
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  isValidMove(row, col) {
    // Check bounds
    if (row < 0 || row >= 8 || col < 0 || col >= 8) {
      return false;
    }

    // Check if cell is empty
    if (this.board[row][col] !== 0) {
      return false;
    }

    const playerColor = this.currentPlayer === 'black' ? 1 : 2;
    return this.wouldFlipPieces(row, col, playerColor);
  }

  /**
   * Check if placing a piece would flip opponent pieces
   * @param {number} row
   * @param {number} col
   * @param {number} playerColor
   * @returns {boolean}
   */
  wouldFlipPieces(row, col, playerColor) {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of directions) {
      if (this.countFlippablePieces(row, col, dr, dc, playerColor) > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Count how many pieces would be flipped in a given direction
   * @param {number} row
   * @param {number} col
   * @param {number} dr
   * @param {number} dc
   * @param {number} playerColor
   * @returns {number}
   */
  countFlippablePieces(row, col, dr, dc, playerColor) {
    const opponentColor = playerColor === 1 ? 2 : 1;
    let count = 0;
    let r = row + dr;
    let c = col + dc;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const cell = this.board[r][c];

      if (cell === 0) {
        return 0; // Empty cell, no flip
      }

      if (cell === opponentColor) {
        count++;
      } else if (cell === playerColor) {
        return count; // Found own piece, return count
      }

      r += dr;
      c += dc;
    }

    return 0; // Reached boundary without finding own piece
  }

  /**
   * Flip opponent pieces in all directions
   * @param {number} row
   * @param {number} col
   * @param {number} playerColor
   */
  flipPieces(row, col, playerColor) {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of directions) {
      this.flipInDirection(row, col, dr, dc, playerColor);
    }
  }

  /**
   * Flip pieces in a specific direction
   * @param {number} row
   * @param {number} col
   * @param {number} dr
   * @param {number} dc
   * @param {number} playerColor
   */
  flipInDirection(row, col, dr, dc, playerColor) {
    const opponentColor = playerColor === 1 ? 2 : 1;
    const piecesToFlip = [];
    let r = row + dr;
    let c = col + dc;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const cell = this.board[r][c];

      if (cell === 0) {
        return; // Empty cell, stop
      }

      if (cell === opponentColor) {
        piecesToFlip.push([r, c]);
      } else if (cell === playerColor) {
        // Found own piece, flip all opponent pieces in between
        for (const [flipRow, flipCol] of piecesToFlip) {
          this.board[flipRow][flipCol] = playerColor;
        }
        return;
      }

      r += dr;
      c += dc;
    }
  }

  /**
   * Get all legal moves for the current player
   * @returns {Array<[number, number]>} Array of [row, col] pairs
   */
  getLegalMoves() {
    const moves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.isValidMove(row, col)) {
          moves.push([row, col]);
        }
      }
    }
    return moves;
  }

  /**
   * Check game status and update if game is finished
   */
  checkGameStatus() {
    const blackMoves = this.getMovesForColor(1);
    const whiteMoves = this.getMovesForColor(2);

    if (blackMoves.length === 0 && whiteMoves.length === 0) {
      // Game finished, no moves available for either player
      this.finishGame();
    } else if (this.currentPlayer === 'black' && blackMoves.length === 0) {
      // Black has no moves, switch to white
      this.currentPlayer = 'white';
      // Check if white has moves
      if (whiteMoves.length === 0) {
        this.finishGame();
      }
    } else if (this.currentPlayer === 'white' && whiteMoves.length === 0) {
      // White has no moves, switch to black
      this.currentPlayer = 'black';
      // Check if black has moves
      if (blackMoves.length === 0) {
        this.finishGame();
      }
    }
  }

  /**
   * Get all legal moves for a specific color
   * @param {number} color - 1 for black, 2 for white
   * @returns {Array<[number, number]>}
   */
  getMovesForColor(color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.board[row][col] === 0 && this.wouldFlipPieces(row, col, color)) {
          moves.push([row, col]);
        }
      }
    }
    return moves;
  }

  /**
   * Finish the game and determine winner
   */
  finishGame() {
    const blackCount = this.countPieces(1);
    const whiteCount = this.countPieces(2);

    this.status = 'finished';
    this.isFinished = true;

    if (blackCount > whiteCount) {
      this.winner = 'black';
    } else if (whiteCount > blackCount) {
      this.winner = 'white';
    } else {
      this.winner = 'draw';
    }
  }

  /**
   * Count pieces of a specific color
   * @param {number} color
   * @returns {number}
   */
  countPieces(color) {
    let count = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.board[row][col] === color) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Finish the game (e.g., due to player resignation)
   */
  finish() {
    this.finishGame();
  }

  /**
   * Serialize game state for transmission
   * @returns {Object}
   */
  serialize() {
    return {
      board: this.board,
      currentPlayer: this.currentPlayer,
      status: this.status,
      winner: this.winner,
      isFinished: this.isFinished,
      blackCount: this.countPieces(1),
      whiteCount: this.countPieces(2),
      blackPlayer: this.blackPlayer,
      whitePlayer: this.whitePlayer
    };
  }

  /**
   * Start turn timer - invokes the callback after TURN_TIME_LIMIT.
   * The caller (socket layer) decides what to do on timeout so that
   * clients can be notified of the resulting move.
   * @param {Function} onTimeout - Called when the current player runs out of time
   */
  startTurn(onTimeout) {
    this.clearTurnTimeout();
    this.turnStartTime = Date.now();
    this.turnDeadline = this.turnStartTime + TURN_TIME_LIMIT;
    this.turnTimeoutId = setTimeout(() => {
      this.turnTimeoutId = null;
      if (onTimeout) onTimeout();
    }, TURN_TIME_LIMIT);
  }

  /**
   * Clear turn timeout - prevents auto-move if player makes a move in time
   * Called when player successfully places a piece
   */
  clearTurnTimeout() {
    if (this.turnTimeoutId) {
      clearTimeout(this.turnTimeoutId);
      this.turnTimeoutId = null;
    }
  }

  /**
   * Auto-move - place a random legal move (or pass) for the current player.
   * Does NOT reschedule the next turn; the caller broadcasts the result
   * and starts the next timer.
   * @returns {{ type: 'move', row: number, col: number } | { type: 'pass' }}
   */
  autoMove() {
    const legalMoves = this.getLegalMoves();

    if (legalMoves.length > 0) {
      const [row, col] = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      this.move(row, col);
      return { type: 'move', row, col };
    }

    // No legal moves - auto-pass by toggling current player
    this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
    this.checkGameStatus();
    return { type: 'pass' };
  }
}

module.exports = ReversiGame;
