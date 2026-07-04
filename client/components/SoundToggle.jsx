import { useState, useEffect } from 'react';
import { isMuted, toggleMuted } from '../lib/sound';

// 効果音のON/OFFトグル（画面右上に固定）
export default function SoundToggle() {
  const [muted, setMuted] = useState(false);

  // SSRとの不一致を避けるためマウント後に読み込む
  useEffect(() => {
    setMuted(isMuted());
  }, []);

  return (
    <button
      onClick={() => setMuted(toggleMuted())}
      aria-label={muted ? '効果音をオンにする' : '効果音をオフにする'}
      title={muted ? '効果音: オフ' : '効果音: オン'}
      className="fixed z-40 w-10 h-10 rounded-full glass flex items-center justify-center text-base transition-opacity hover:opacity-80"
      style={{
        top: 'max(0.9rem, env(safe-area-inset-top))',
        right: 'max(0.9rem, env(safe-area-inset-right))',
        opacity: muted ? 0.55 : 1,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
