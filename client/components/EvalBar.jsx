import { evaluateFor } from '../lib/ai';
import { WHITE } from '../lib/reversi';

// 形勢グラフ：AIの静的評価で白⇔紫の優勢度を帯で表示（観戦・リプレイ用）。
// 対局者には見せない（ヒントになってしまうため）。
export default function EvalBar({ board, className = '' }) {
  if (!board) return null;
  const score = evaluateFor(board, WHITE); // 白視点
  // tanhで-1..1へ潰して 0..100% に（±250点でほぼ振り切る）
  const whitePct = 50 + Math.tanh(score / 250) * 50;

  return (
    <div className={`w-full max-w-[13rem] mx-auto ${className}`}>
      <div className="flex justify-between text-[10px] text-white/55 mb-0.5 px-0.5">
        <span>白</span>
        <span>形勢</span>
        <span>紫</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-white/10">
        <div
          className="h-full"
          style={{
            width: `${whitePct}%`,
            background: 'linear-gradient(90deg, #ffffff, #d7cff0)',
            transition: 'width 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <div
          className="h-full flex-1"
          style={{ background: 'linear-gradient(90deg, #8b5cf6, #6d28d9)' }}
        />
      </div>
    </div>
  );
}
