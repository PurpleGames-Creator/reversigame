import { useState, useEffect } from 'react';

export default function Timer({ isActive, onTimeUp, initialTime = 20 }) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(initialTime);
      return;
    }
    if (timeLeft === 0) {
      onTimeUp();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, timeLeft, initialTime, onTimeUp]);

  useEffect(() => {
    if (!isActive) setTimeLeft(initialTime);
  }, [initialTime, isActive]);

  const urgent = timeLeft <= 5;
  const pct = Math.max(0, Math.min(1, timeLeft / initialTime));

  return (
    <div className="mx-auto mt-3 w-40">
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={`text-2xl font-bold tabular-nums transition-colors ${
            urgent ? 'text-rose-300' : 'text-white'
          }`}
        >
          {timeLeft}
        </span>
        <span className="text-xs text-white/50">秒</span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-white/12 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            urgent ? 'bg-rose-400' : 'bg-violet-300'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
