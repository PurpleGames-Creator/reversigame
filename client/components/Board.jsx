import { PIECE_WHITE, PIECE_PURPLE } from '../lib/constants';

const PIECE_EMPTY = 0;

export default function Board({ board, legalMoves, lastMove, onCellClick }) {
  const handleCellClick = (row, col) => {
    if (onCellClick && !board[row][col] && legalMoves.includes(`${row},${col}`)) {
      onCellClick(row, col);
    }
  };

  const isLegalMove = (row, col) => legalMoves.includes(`${row},${col}`);
  const isLastMove = (row, col) => lastMove && lastMove.row === row && lastMove.col === col;

  return (
    <div className="flex justify-center items-center flex-1 p-4" data-no-uisound>
      <div
        className="relative rounded-3xl p-2.5 w-full"
        style={{
          maxWidth: 'min(92vw, 460px)',
          aspectRatio: '1 / 1',
          background: 'linear-gradient(160deg, #241a3d 0%, #1a1130 100%)',
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
            background: 'rgba(255,255,255,0.06)',
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
                    background:
                      empty && legal
                        ? 'rgba(139,92,246,0.14)'
                        : 'linear-gradient(160deg, #2f2450 0%, #271c44 100%)',
                    cursor: empty && legal ? 'pointer' : 'default',
                  }}
                >
                  {/* 石 */}
                  {piece !== PIECE_EMPTY && (
                    <div
                      className={`absolute inset-[14%] rounded-full ${last ? 'piece-flip' : 'piece-fade-in'}`}
                      style={
                        piece === PIECE_WHITE
                          ? {
                              background:
                                'radial-gradient(circle at 32% 28%, #ffffff 0%, #f1eefb 55%, #d7cff0 100%)',
                              boxShadow:
                                '0 3px 6px rgba(0,0,0,0.35), inset 0 -2px 4px rgba(120,110,160,0.35), inset 0 2px 3px rgba(255,255,255,0.9)',
                            }
                          : {
                              background:
                                'radial-gradient(circle at 32% 28%, #a78bfa 0%, #7c3aed 55%, #5b21b6 100%)',
                              boxShadow:
                                '0 3px 8px rgba(30,8,60,0.5), inset 0 -2px 4px rgba(40,10,80,0.5), inset 0 2px 3px rgba(214,197,255,0.55)',
                            }
                      }
                    />
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
