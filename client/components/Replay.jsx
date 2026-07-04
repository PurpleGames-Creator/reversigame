import { useState, useEffect } from 'react';
import Board from './Board';
import EvalBar from './EvalBar';

// 直前対局のリプレイ。frames は [{ board, lastMove }] の配列
// （初期盤面＋着手ごとのスナップショット）。自動再生＋コマ送りに対応。
export default function Replay({ frames, onClose }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  const last = frames.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (idx >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, last)), 850);
    return () => clearTimeout(t);
  }, [playing, idx, last]);

  if (!frames || frames.length === 0) return null;
  const frame = frames[Math.min(idx, last)];

  const Btn = ({ onClick, children, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="glass rounded-full w-11 h-11 flex items-center justify-center text-white text-lg disabled:opacity-30 hover:bg-white/15 active:scale-95 transition"
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-[#2a0f4c]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[560px] flex flex-col items-center">
        <p className="text-white/80 text-sm font-semibold mb-1 tabular-nums">
          リプレイ　{idx} / {last} 手
        </p>
        <EvalBar board={frame.board} className="mb-1" />

        <Board
          board={frame.board}
          legalMoves={[]}
          lastMove={frame.lastMove}
          finished={false}
        />

        <div className="flex items-center gap-3 mt-2">
          <Btn onClick={() => { setPlaying(false); setIdx(0); }} disabled={idx === 0}>⏮</Btn>
          <Btn onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); }} disabled={idx === 0}>◀</Btn>
          <Btn
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (idx >= last) setIdx(0);
                setPlaying(true);
              }
            }}
          >
            {playing ? '⏸' : '▶'}
          </Btn>
          <Btn onClick={() => { setPlaying(false); setIdx((i) => Math.min(last, i + 1)); }} disabled={idx >= last}>▶▶</Btn>
          <Btn onClick={() => { setPlaying(false); setIdx(last); }} disabled={idx >= last}>⏭</Btn>
        </div>

        <button onClick={onClose} className="btn btn-glass px-8 py-3 mt-4">
          リプレイを閉じる
        </button>
      </div>
    </div>
  );
}
