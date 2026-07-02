// クライアント側リバーシエンジン（純粋関数）
// 盤面値: 0 = 空, 1 = 白(先手), 2 = 紫(後手)
// サーバー版 ReversiGame.js と同じルール。CPU対戦(pages/cpu.js)で使用。

export const EMPTY = 0;
export const WHITE = 1; // 先手
export const PURPLE = 2; // 後手

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// 初期盤面を生成
export function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  board[3][3] = PURPLE;
  board[3][4] = WHITE;
  board[4][3] = WHITE;
  board[4][4] = PURPLE;
  return board;
}

export function opponent(color) {
  return color === WHITE ? PURPLE : WHITE;
}

// (row,col) に color を置いたとき裏返る石の座標一覧
export function getFlips(board, row, col, color) {
  if (board[row][col] !== EMPTY) return [];
  const opp = opponent(color);
  const flips = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opp) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

// 合法手かどうか
export function isLegalMove(board, row, col, color) {
  return getFlips(board, row, col, color).length > 0;
}

// color の合法手を "row,col" 文字列配列で返す（Boardコンポーネント互換）
export function getLegalMoves(board, color) {
  const moves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === EMPTY && isLegalMove(board, row, col, color)) {
        moves.push(`${row},${col}`);
      }
    }
  }
  return moves;
}

export function hasAnyMove(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === EMPTY && isLegalMove(board, row, col, color)) {
        return true;
      }
    }
  }
  return false;
}

// 着手を適用して新しい盤面を返す（元の盤面は変更しない）
export function applyMove(board, row, col, color) {
  const flips = getFlips(board, row, col, color);
  if (flips.length === 0) return board;
  const next = board.map((r) => r.slice());
  next[row][col] = color;
  for (const [fr, fc] of flips) {
    next[fr][fc] = color;
  }
  return next;
}

export function countPieces(board, color) {
  let count = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === color) count++;
    }
  }
  return count;
}

// 終局判定と勝者。戻り値: { finished, winner } winner: WHITE | PURPLE | 'draw' | null
export function evaluateStatus(board) {
  const finished = !hasAnyMove(board, WHITE) && !hasAnyMove(board, PURPLE);
  if (!finished) return { finished: false, winner: null };
  const white = countPieces(board, WHITE);
  const purple = countPieces(board, PURPLE);
  let winner = 'draw';
  if (white > purple) winner = WHITE;
  else if (purple > white) winner = PURPLE;
  return { finished: true, winner };
}
