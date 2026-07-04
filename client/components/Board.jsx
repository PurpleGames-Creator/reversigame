import { PIECE_WHITE, PIECE_PURPLE } from '../lib/constants';

const PIECE_EMPTY = 0;

// 盤面テーマ（枠・マス・罫線の色だけ差し替え。石やマーカーは共通）
const THEMES = {
  purple: {
    frame: 'linear-gradient(160deg, #241a3d 0%, #1a1130 100%)',
    cell: 'linear-gradient(160deg, #2f2450 0%, #271c44 100%)',
    line: 'rgba(255,255,255,0.06)',
  },
  green: {
    frame: 'linear-gradient(160deg, #12352a 0%, #0b241b 100%)',
    cell: 'linear-gradient(160deg, #1e7a4a 0%, #166141 100%)',
    line: 'rgba(0,0,0,0.28)',
  },
  wood: {
    frame: 'linear-gradient(160deg, #4a2f1b 0%, #33200f 100%)',
    cell: 'linear-gradient(160deg, #9c6b3d 0%, #855429 100%)',
    line: 'rgba(50,28,10,0.55)',
  },
};

export default function Board({ board, legalMoves, lastMove, onCellClick, finished, hintCell, theme = 'green' }) {
  const t = THEMES[theme] || THEMES.green;
  const handleCellClick = (row, col) => {
    if (onCellClick && !board[row][col] && legalMoves.includes(`${row},${col}`)) {
      onCellClick(row, col);
    }
  };

  const isLegalMove = (row, col) => legalMoves.includes(`${row},${col}`);
  const isLastMove = (row, col) => lastMove && lastMove.row === row && lastMove.col === col;

  // 裏返しの波及ディレイ：置いた石からのチェビシェフ距離に応じて
  // 60ms + (距離-1)×52ms。効果音のカスケード(sound.js)と同じ刻み。
  const flipDelay = (row, col) => {
    if (!lastMove) return 0;
    const d = Math.max(Math.abs(row - lastMove.row), Math.abs(col - lastMove.col));
    if (d === 0) return 0;
    return 60 + (d - 1) * 52;
  };

  return (
    <div className="flex justify-center items-center flex-1 p-4" data-no-uisound>
      <div
        className="relative rounded-3xl p-2.5 w-full"
        style={{
          // 幅・高さ両方に収まる最大サイズ（iPad/PCでは560pxまで拡大、
          // 高さの低い画面では74vhで頭打ちにしてはみ出しを防ぐ）
          maxWidth: 'min(92vw, 74vh, 560px)',
          aspectRatio: '1 / 1',
          background: t.frame,
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow:
            '0 30px 70px -24px rgba(10,2,30,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="grid h-full w-full overflow-hidden rounded-2xl"
          style={{
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '1px',
            background: t.line,
          }}
        >
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => {
              const piece = board[row][col];
              const legal = isLegalMove(row, col);
              const empty = piece === PIECE_EMPTY;
              const last = isLastMove(row, col);

              return (
                <button
                  key={`${row},${col}`}
                  onClick={() => handleCellClick(row, col)}
                  disabled={!empty || !legal}
                  className="relative aspect-square focus:outline-none transition-colors"
                  style={{
                    background: empty && legal ? 'rgba(139,92,246,0.2)' : t.cell,
                    cursor: empty && legal ? 'pointer' : 'default',
                  }}
                >
                  {/* 石（白/紫の2面を持ち、値が変わると3Dフリップで裏返る） */}
                  {piece !== PIECE_EMPTY && (
                    <div
                      className={`piece-wrap absolute inset-[14%] ${finished ? 'piece-wave' : ''}`}
                      style={finished ? { animationDelay: `${(row + col) * 45}ms` } : undefined}
                    >
                      <div
                        className="piece-3d"
                        data-face={piece === PIECE_WHITE ? 'white' : 'purple'}
                        style={{ transitionDelay: `${flipDelay(row, col)}ms` }}
                      >
                        <div className="piece-face piece-face-white" />
                        <div className="piece-face piece-face-purple" />
                      </div>
                    </div>
                  )}

                  {/* 直前手マーカー（上品なリング） */}
                  {last && piece !== PIECE_EMPTY && (
                    <div
                      className="absolute top-1/2 left-1/2 rounded-full"
                      style={{
                        width: '22%',
                        height: '22%',
                        transform: 'translate(-50%, -50%)',
                        border: '2px solid rgba(255,255,255,0.85)',
                        boxShadow: '0 0 8px rgba(255,255,255,0.5)',
                      }}
                    />
                  )}

                  {/* ヒントマーカー（金色の点滅リング） */}
                  {empty && hintCell && hintCell.row === row && hintCell.col === col && (
                    <div className="hint-ring absolute inset-[16%] rounded-full" />
                  )}

                  {/* 合法手マーカー（淡い光点） */}
                  {empty && legal && (
                    <div
                      className="legal-dot absolute top-1/2 left-1/2 rounded-full"
                      style={{
                        width: '26%',
                        height: '26%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(196,181,253,0.85)',
                        boxShadow: '0 0 10px rgba(167,139,250,0.7)',
                      }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
