import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { initSocket } from '../lib/socket';
import Board from '../components/Board';
import PlayerInfo from '../components/PlayerInfo';
import Timer from '../components/Timer';

export default function GamePage() {
  const router = useRouter();
  const { roomId } = router.query;
  const [gameState, setGameState] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const socket = initSocket();

  // Initialize game when roomId is available
  useEffect(() => {
    if (!roomId) return;

    if (!socket.connected) {
      router.push('/');
      return;
    }

    setLoading(true);

    // Listen for game-started event
    const handleGameStarted = (data) => {
      setGameState(data);
      setLoading(false);
    };

    // Listen for board-updated event
    const handleBoardUpdated = (data) => {
      setGameState((prev) => ({
        ...prev,
        board: data.board,
        lastMove: data.lastMove,
        currentPlayer: data.currentPlayer,
        player1: data.player1,
        player2: data.player2,
      }));
    };

    // Listen for legal-moves-updated event
    const handleLegalMovesUpdated = (data) => {
      setLegalMoves(data.legalMoves || []);
    };

    // Listen for game-finished event
    const handleGameFinished = (data) => {
      setGameState((prev) => ({
        ...prev,
        gameState: 'finished',
        board: data.board,
        winner: data.winner,
        player1: data.player1,
        player2: data.player2,
      }));
    };

    // Listen for opponent-disconnected event
    const handleOpponentDisconnected = () => {
      setError('対手が接続を切りました');
    };

    socket.on('game-started', handleGameStarted);
    socket.on('board-updated', handleBoardUpdated);
    socket.on('legal-moves-updated', handleLegalMovesUpdated);
    socket.on('game-finished', handleGameFinished);
    socket.on('opponent-disconnected', handleOpponentDisconnected);

    // Request initial game state
    socket.emit('get-game-state', { roomId }, (data) => {
      if (data && data.board) {
        setGameState(data);
        setLegalMoves(data.legalMoves || []);
        setLoading(false);
      }
    });

    // Cleanup
    return () => {
      socket.off('game-started', handleGameStarted);
      socket.off('board-updated', handleBoardUpdated);
      socket.off('legal-moves-updated', handleLegalMovesUpdated);
      socket.off('game-finished', handleGameFinished);
      socket.off('opponent-disconnected', handleOpponentDisconnected);
    };
  }, [roomId, socket, router]);

  const handleCellClick = (row, col) => {
    setLoading(true);
    socket.emit(
      'place-piece',
      { roomId, row, col },
      (response) => {
        setLoading(false);
        if (response && response.error) {
          setError(response.error);
        }
      }
    );
  };

  const handleResign = () => {
    setLoading(true);
    socket.emit('resign', { roomId }, () => {
      setLoading(false);
    });
  };

  const handleLeaveRoom = () => {
    socket.emit('leave-room', { roomId });
    router.push('/lobby');
  };

  const handleCloseError = () => {
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-xl font-bold text-gray-800">ゲーム読み込み中...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-xl font-bold text-gray-800">ゲーム情報を読み込めません</p>
      </div>
    );
  }

  const isPlaying = gameState.gameState === 'playing';
  const isFinished = gameState.gameState === 'finished';
  // 自分の手番のときだけ合法手を表示・着手可能にする（相手の番に誤タップさせない）
  const myTurn = isPlaying && socket && gameState.currentPlayer === socket.id;
  const shownLegalMoves = myTurn ? legalMoves : [];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-600 text-red-700 p-4 mx-4 mt-4 rounded flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={handleCloseError}
            className="text-red-700 font-bold hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Player Info */}
      <PlayerInfo
        player1={gameState.player1}
        player2={gameState.player2}
        currentPlayer={gameState.currentPlayer}
      />

      {/* Turn indicator */}
      {isPlaying && (
        <div className="text-center mt-2">
          <span
            className={`inline-block text-sm font-bold rounded-full px-4 py-1 ${
              myTurn ? 'bg-yellow-300 text-purple-900' : 'bg-black/30 text-white'
            }`}
          >
            {myTurn ? 'あなたの番です' : '相手の番です…'}
          </span>
        </div>
      )}

      {/* Timer (only show during playing) */}
      {isPlaying && (
        <Timer
          isActive={true}
          onTimeUp={() => {
            // TODO: Handle time up
          }}
          initialTime={20}
        />
      )}

      {/* Board */}
      <Board
        board={gameState.board}
        legalMoves={shownLegalMoves}
        lastMove={gameState.lastMove}
        onCellClick={handleCellClick}
      />

      {/* Button Section */}
      <div className="border-t border-gray-200 bg-white p-4 mx-4 mb-4 space-y-3">
        {isPlaying ? (
          <button
            onClick={handleResign}
            disabled={loading}
            className="w-full bg-red-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '処理中...' : '投了'}
          </button>
        ) : isFinished ? (
          <button
            onClick={handleLeaveRoom}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            ロビーに戻る
          </button>
        ) : null}
      </div>

      {/* Game Over Modal */}
      {isFinished && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-2xl font-bold text-center mb-4">ゲーム終了</h2>

            {gameState.winner === 'draw' ? (
              <p className="text-center text-lg font-semibold text-gray-800 mb-6">
                引き分けです
              </p>
            ) : (
              <p className="text-center text-lg font-semibold text-gray-800 mb-6">
                {gameState.winner === gameState.player1?.id
                  ? `${gameState.player1?.name}（白）が勝利しました！`
                  : `${gameState.player2?.name}（紫）が勝利しました！`}
              </p>
            )}

            {/* Final Scores */}
            <div className="flex justify-between mb-6 text-center">
              <div>
                <p className="text-sm font-medium text-gray-600">白</p>
                <p className="text-2xl font-bold text-gray-800">
                  {gameState.player1?.pieces || 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">紫</p>
                <p className="text-2xl font-bold text-purple-600">
                  {gameState.player2?.pieces || 0}
                </p>
              </div>
            </div>

            <button
              onClick={handleLeaveRoom}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              ロビーに戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
