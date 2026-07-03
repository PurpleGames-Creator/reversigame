import { useState, useEffect } from 'react';

// サーバー同期タイマー。
// deadline はローカル時計基準のエポックms（サーバーから受け取った
// turnRemaining を受信時の Date.now() に足したもの）。手番が変わって
// deadline が更新されるたびに自動でリセットされる。
export default function Timer({ deadline, totalMs = 20000 }) {
  const [remaining, setRemaining] = useState(() =>
    deadline ? Math.max(0, deadline - Date.now()) : totalMs
  );

  useEffect(() => {
    if (!deadline) {
      setRemaining(totalMs);
      return;
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [deadline, totalMs]);

  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 5;
  const pct = Math.max(0, Math.min(1, remaining / totalMs));

  return (
    <div className="mx-auto mt-3 w-40">
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={`text-2xl font-bold tabular-nums transition-colors ${
            urgent ? 'text-rose-300' : 'text-white'
          }`}
        >
          {seconds}
        </span>
        <span className="text-xs text-white/70">秒</span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-white/12 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            urgent ? 'bg-rose-400' : 'bg-violet-300'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
