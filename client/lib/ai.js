// CPU（パプ子）の思考ルーチン
// 難易度: 'easy'（よわい）/ 'normal'（ふつう）/ 'hard'（つよい）
import {
  EMPTY,
  opponent,
  getLegalMoves,
  applyMove,
  hasAnyMove,
  countPieces,
} from './reversi';

// マス目の価値表（角が最強、角隣は危険）
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function parseMove(str) {
  const [row, col] = str.split(',').map(Number);
  return { row, col };
}

function countEmpty(board) {
  let n = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === EMPTY) n++;
  return n;
}

// me視点の評価値。終盤は石差重視、序中盤は位置＋機動力重視。
function evaluate(board, me) {
  const opp = opponent(me);
  const empties = countEmpty(board);

  const myDiscs = countPieces(board, me);
  const oppDiscs = countPieces(board, opp);

  // 終盤（残り12マス以下）は純粋な石差で読み切りに寄せる
  if (empties <= 12) {
    return (myDiscs - oppDiscs) * 10;
  }

  // 位置評価
  let position = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === me) position += WEIGHTS[r][c];
      else if (board[r][c] === opp) position -= WEIGHTS[r][c];
    }
  }

  // 機動力（打てる手の多さ）
  const myMob = getLegalMoves(board, me).length;
  const oppMob = getLegalMoves(board, opp).length;
  const mobility = (myMob - oppMob) * 10;

  return position + mobility;
}

// αβ法。me視点の最善評価値を返す。
function alphabeta(board, turn, me, depth, alpha, beta) {
  if (depth === 0) {
    return evaluate(board, me);
  }

  const moves = getLegalMoves(board, turn);

  // パス処理
  if (moves.length === 0) {
    if (!hasAnyMove(board, opponent(turn))) {
      // 両者打てない＝終局。石差で確定評価。
      return evaluate(board, me) + (countPieces(board, me) - countPieces(board, opponent(me))) * 100;
    }
    return alphabeta(board, opponent(turn), me, depth - 1, alpha, beta);
  }

  if (turn === me) {
    let best = -Infinity;
    for (const m of moves) {
      const { row, col } = parseMove(m);
      const next = applyMove(board, row, col, turn);
      best = Math.max(best, alphabeta(next, opponent(turn), me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const { row, col } = parseMove(m);
      const next = applyMove(board, row, col, turn);
      best = Math.min(best, alphabeta(next, opponent(turn), me, depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 1手先の位置評価で最善手を選ぶ（軽量）
function greedyBest(board, color, moves) {
  let best = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const { row, col } = parseMove(m);
    const next = applyMove(board, row, col, color);
    const score = evaluate(next, color);
    if (score > bestScore) {
      bestScore = score;
      best = { row, col };
    }
  }
  return best;
}

// αβ探索で最善手を選ぶ
function searchBest(board, color, moves, depth) {
  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  // 手順を軽くシャッフルして同点時の単調さを避ける
  const shuffled = moves.slice().sort(() => Math.random() - 0.5);
  for (const m of shuffled) {
    const { row, col } = parseMove(m);
    const next = applyMove(board, row, col, color);
    const score = alphabeta(next, opponent(color), color, depth - 1, alpha, beta);
    if (score > bestScore) {
      bestScore = score;
      best = { row, col };
    }
    alpha = Math.max(alpha, bestScore);
  }
  return best;
}

// CPUの着手を決める。戻り値 { row, col } または null（打てない＝パス）
// よわい: 1手先の位置評価（ときどきブレる）／ふつう: αβ深さ2／つよい: αβ深さ4＋終盤読み切り
export function chooseMove(board, color, difficulty = 'normal') {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;

  // よわい: 位置評価ベース。少しだけブレて人間味を出す。
  if (difficulty === 'easy') {
    if (Math.random() < 0.15) return parseMove(pickRandom(moves));
    return greedyBest(board, color, moves);
  }

  const empties = countEmpty(board);

  // ふつう: 数手先を読む（終盤は読み切り）
  if (difficulty === 'normal') {
    const depth = empties <= 10 ? empties : 2;
    return searchBest(board, color, moves, depth);
  }

  // つよい: さらに深く読む
  const depth = empties <= 10 ? empties : 4;
  return searchBest(board, color, moves, depth);
}
