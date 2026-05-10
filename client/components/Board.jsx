import { PIECE_WHITE, PIECE_PURPLE, COLORS } from '../lib/constants';

const PIECE_EMPTY = 0;

export default function Board({ board, legalMoves, lastMove, onCellClick }) {
  const handleCellClick = (row, col) => {
    if (onCellClick && !board[row][col] && legalMoves.includes(`${row},${col}`)) {
      onCellClick(row, col);
    }
  };

  const isLegalMove = (row, col) => {
    return legalMoves.includes(`${row},${col}`);
  };

  const isLastMove = (row, col) => {
    return lastMove && lastMove.row === row && lastMove.col === col;
  };

  const isPieceEmpty = (row, col) => {
    return board[row][col] === PIECE_EMPTY;
  };

  return (
    <div className="flex justify-center items-center flex-1 p-4">
      <div className="grid gap-0 p-2 bg-green-700 rounded-lg shadow-lg" style={{
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        aspectRatio: '1 / 1',
      }}>
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => {
            const piece = board[row][col];
            const isLegal = isLegalMove(row, col);
            const isEmpty = isPieceEmpty(row, col);
            const isLast = isLastMove(row, col);

            return (
              <button
                key={`${row},${col}`}
                onClick={() => handleCellClick(row, col)}
                disabled={!isEmpty || !isLegal}
                className={`
                  relative aspect-square border border-green-800 transition-colors
                  ${isEmpty && isLegal ? 'bg-green-100 hover:bg-green-200 cursor-pointer' : 'bg-green-700 cursor-default'}
                  ${!isEmpty ? 'shadow-inset' : ''}
                  focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-400
                `}
              >
                {/* Piece */}
                {piece !== PIECE_EMPTY && (
                  <div
                    className={`
                      absolute inset-2 rounded-full shadow-lg
                      ${piece === PIECE_WHITE ? 'bg-white' : 'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700'}
                      ${isLast ? 'piece-flip' : 'piece-fade-in'}
                    `}
                    style={{
                      boxShadow: piece === PIECE_WHITE
                        ? '0 4px 8px rgba(0,0,0,0.2), inset -2px -2px 4px rgba(0,0,0,0.1)'
                        : '0 4px 8px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                )}

                {/* Last move indicator (red dot if piece placed) */}
                {isLast && piece !== PIECE_EMPTY && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
                )}

                {/* Legal move indicator (white dot if empty) */}
                {isEmpty && isLegal && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
