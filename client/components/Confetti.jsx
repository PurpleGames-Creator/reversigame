import { useRef, useEffect } from 'react';

export default function Confetti() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const colors = ['#a78bfa', '#ffffff'];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const distance = 150 + Math.random() * 100;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      // 終局カード(modalPop: 0.55s delay + 0.5s)が着地するタイミングで弾けさせる
      const delay = 900 + Math.random() * 120;

      const div = document.createElement('div');
      div.className = 'confetti-item';
      div.style.background = colors[i % 2];
      div.style.animationDelay = `${delay}ms`;
      div.style.setProperty('--tx', `${tx}px`);
      div.style.setProperty('--ty', `${ty}px`);
      containerRef.current.appendChild(div);
    }
  }, []);

  return <div ref={containerRef} className="confetti-container" />;
}
