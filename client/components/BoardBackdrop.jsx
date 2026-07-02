// タイトルのパプ子背後に敷く装飾用リバーシ盤（操作不可・雰囲気づくり）。
// 中盤っぽくコマを散らし、縁に向けてフェードさせて背景に溶け込ませる。
const PATTERN = [
  [0, 0, 1, 2, 0, 0, 0, 0],
  [0, 2, 1, 1, 2, 0, 0, 0],
  [0, 1, 2, 1, 2, 1, 0, 0],
  [1, 2, 1, 2, 1, 2, 1, 0],
  [0, 1, 2, 1, 2, 1, 2, 1],
  [0, 0, 1, 2, 1, 2, 1, 0],
  [0, 0, 0, 2, 1, 2, 0, 0],
  [0, 0, 0, 0, 2, 1, 0, 0],
];

export default function BoardBackdrop({ size = 300, opacity = 0.55 }) {
  const mask = 'radial-gradient(circle at 50% 50%, #000 40%, transparent 72%)';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{
        width: size,
        height: size,
        opacity,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: size * 0.09,
          background: 'linear-gradient(160deg,#241a3d,#1a1130)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: size * 0.025,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8,1fr)',
            gap: 1,
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: size * 0.06,
            overflow: 'hidden',
          }}
        >
          {PATTERN.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  position: 'relative',
                  background: 'linear-gradient(160deg,#2f2450,#271c44)',
                }}
              >
                {v !== 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '18%',
                      borderRadius: '50%',
                      background:
                        v === 1
                          ? 'radial-gradient(circle at 32% 28%,#ffffff,#e7e0fb 60%,#cfc4ee)'
                          : 'radial-gradient(circle at 32% 28%,#a78bfa,#7c3aed 60%,#5b21b6)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
