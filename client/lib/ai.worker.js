// CPU（パプ子）の思考をメインスレッドの外で実行する Web Worker。
// 「究極」は最大~2.8秒計算するため、UIを固めないようにここで動かす。
import { chooseMove } from './ai';

self.onmessage = (e) => {
  const { id, board, color, difficulty } = e.data || {};
  try {
    const mv = chooseMove(board, color, difficulty);
    self.postMessage({ id, mv });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message) });
  }
};
