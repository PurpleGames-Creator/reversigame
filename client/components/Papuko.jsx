import Image from 'next/image';

// パプ子（パプ太郎＋リボン）マスコット。Purple Games 共通キャラ。
// size: 画像の一辺(px)。float: ふわふわ浮遊。glow: 背後に柔らかな光。
export default function Papuko({ size = 140, float = false, glow = false, className = '' }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            width: size * 1.5,
            height: size * 1.5,
            background:
              'radial-gradient(circle, rgba(167,139,250,0.55) 0%, rgba(124,58,237,0.15) 45%, transparent 70%)',
            filter: 'blur(6px)',
          }}
        />
      )}
      <div
        className={`relative ${float ? 'papuko-float' : ''}`}
        style={{ width: size, height: size }}
      >
        <Image
          src="/paputaro.png"
          alt="パプ子"
          width={size}
          height={size}
          priority
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 12px 20px rgba(20,4,45,0.45))',
          }}
        />
        {/* リボン */}
        <span
          className="absolute select-none"
          style={{
            top: -size * 0.05,
            left: '50%',
            transform: 'translateX(-28%)',
            fontSize: size * 0.32,
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 3px rgba(20,4,45,0.35))',
          }}
          aria-hidden="true"
        >
          🎀
        </span>
      </div>
    </div>
  );
}
