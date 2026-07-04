// CPU（パプ子）の思考ルーチン
// 難易度: 'easy'（よわい）/ 'normal'（ふつう）/ 'hard'（つよい）/ 'ultimate'（究極）
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

// 時間切れ通知用（究極の反復深化で使用）
const TIME_UP = new Error('ai time up');

// 位置価値の高い順に並べ替え（αβの枝刈り効率を上げる）
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    const A = parseMove(a);
    const B = parseMove(b);
    return WEIGHTS[B.row][B.col] - WEIGHTS[A.row][A.col];
  });
}

// αβ法。me視点の最善評価値を返す。
// ordered: 手を位置価値順に読む（究極用）／deadline: 過ぎたら TIME_UP を投げる
function alphabeta(board, turn, me, depth, alpha, beta, ordered = false, deadline = 0) {
  if (deadline && Date.now() > deadline) throw TIME_UP;
  if (depth === 0) {
    return evaluate(board, me);
  }

  let moves = getLegalMoves(board, turn);

  // パス処理
  if (moves.length === 0) {
    if (!hasAnyMove(board, opponent(turn))) {
      // 両者打てない＝終局。石差で確定評価。
      return evaluate(board, me) + (countPieces(board, me) - countPieces(board, opponent(me))) * 100;
    }
    return alphabeta(board, opponent(turn), me, depth - 1, alpha, beta, ordered, deadline);
  }

  if (ordered) moves = orderMoves(moves);

  if (turn === me) {
    let best = -Infinity;
    for (const m of moves) {
      const { row, col } = parseMove(m);
      const next = applyMove(board, row, col, turn);
      best = Math.max(best, alphabeta(next, opponent(turn), me, depth - 1, alpha, beta, ordered, deadline));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const { row, col } = parseMove(m);
      const next = applyMove(board, row, col, turn);
      best = Math.min(best, alphabeta(next, opponent(turn), me, depth - 1, alpha, beta, ordered, deadline));
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
function searchBest(board, color, moves, depth, ordered = false, deadline = 0) {
  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  // 究極は位置価値順（枝刈り効率優先）、それ以外は軽くシャッフルして同点時の単調さを避ける
  const list = ordered ? orderMoves(moves) : moves.slice().sort(() => Math.random() - 0.5);
  for (const m of list) {
    const { row, col } = parseMove(m);
    const next = applyMove(board, row, col, color);
    const score = alphabeta(next, opponent(color), color, depth - 1, alpha, beta, ordered, deadline);
    if (score > bestScore) {
      bestScore = score;
      best = { row, col };
    }
    alpha = Math.max(alpha, bestScore);
  }
  return best;
}

// 究極: 反復深化。時間予算内で深さを1つずつ増やし、最後に完了した深さの最善手を返す。
export function searchBestTimed(board, color, moves, budgetMs = 2800, maxDepth = 12) {
  const start = Date.now();
  const deadline = start + budgetMs;
  let best = searchBest(board, color, moves, 4, true); // 保険（つよい相当は必ず確保）
  for (let depth = 5; depth <= maxDepth; depth++) {
    // 次の深さは数倍かかる見込みなので、予算の1/4を超えていたら打ち切り
    if (Date.now() - start > budgetMs / 4) break;
    try {
      best = searchBest(board, color, moves, depth, true, deadline);
    } catch (e) {
      if (e === TIME_UP) break; // 途中打ち切り＝直前の深さの手を使う
      throw e;
    }
  }
  return best;
}

// CPUの着手を決める。戻り値 { row, col } または null（打てない＝パス）
// よわい: 1手先の位置評価（ときどきブレる）／ふつう: αβ深さ2／つよい: αβ深さ4＋終盤読み切り
// 究極: 反復深化（時間予算~2.8秒・深さ5〜）＋終盤14マス読み切り
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

  // 究極: 時間の許す限り深く（終盤は14マスから読み切り）
  if (difficulty === 'ultimate') {
    if (empties <= 14) {
      try {
        return searchBest(board, color, moves, empties, true, Date.now() + 2800);
      } catch (e) {
        if (e === TIME_UP) return searchBest(board, color, moves, 6, true);
        throw e;
      }
    }
    return searchBestTimed(board, color, moves, 2800);
  }

  // つよい: さらに深く読む
  const depth = empties <= 10 ? empties : 4;
  return searchBest(board, color, moves, depth);
}
