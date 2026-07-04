import { useRef, useEffect } from 'react';

// 勝利のクラッカー。origin（画面内の%位置）から放射状に弾ける。
// delay をずらして複数置くと時間差の花火になる。
export default function Confetti({
  colors = ['#a78bfa', '#ffffff'],
  count = 20,
  delay = 900, // 終局カード(modalPop: 0.55s delay + 0.5s)の着地に合わせた既定値
  origin = { x: 50, y: 50 },
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 150 + Math.random() * 100;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const d = delay + Math.random() * 120;

      const div = document.createElement('div');
      div.className = 'confetti-item';
      div.style.background = colors[i % colors.length];
      div.style.top = `${origin.y}%`;
      div.style.left = `${origin.x}%`;
      div.style.animationDelay = `${d}ms`;
      div.style.setProperty('--tx', `${tx}px`);
      div.style.setProperty('--ty', `${ty}px`);
      containerRef.current.appendChild(div);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="confetti-container" />;
}
