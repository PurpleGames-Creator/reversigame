import Image from 'next/image';

// パプ子（パプ太郎＋リボン）マスコット。Purple Games 共通キャラ。
// size: 画像の一辺(px)。float: 上下にふわふわ浮かせる。
export default function Papuko({ size = 140, float = false, className = '' }) {
  return (
    <div
      className={`relative inline-block ${float ? 'papuko-float' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/paputaro.png"
        alt="パプ子"
        width={size}
        height={size}
        priority
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {/* リボン */}
      <span
        className="absolute select-none"
        style={{
          top: -size * 0.06,
          left: '50%',
          transform: 'translateX(-30%)',
          fontSize: size * 0.34,
          lineHeight: 1,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
        }}
        aria-hidden="true"
      >
        🎀
      </span>
    </div>
  );
}
