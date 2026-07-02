import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import Board from '../components/Board';
import PlayerInfo from '../components/PlayerInfo';
import Timer from '../components/Timer';
import { playPlace, playFlips, unlockAudio } from '../lib/sound';

// 2つの盤面で色が変わったマス数を数える（＝置いた1手＋裏返った枚数）
function countChanged(prev, next) {
  if (!prev || !next) return 0;
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (prev[r][c] !== next[r][c]) n++;
  return n;
}

export default function GamePage() {
  const router = useRouter();
  const { roomId } = router.query;
  const [gameState, setGameState] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rematch, setRematch] = useState('idle'); // idle | waiting | offered
  const prevBoardRef = useRef(null);

  const socket = initSocket();

  // 観戦側もどこかを触れば音が有効化されるように
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (!socket.connected) {
      router.push('/');
      return;
    }
    setLoading(true);

    const handleGameStarted = (data) => {
      prevBoardRef.current = data.board;
      setGameState(data);
      setRematch('idle');
      setError(null);
      setLoading(false);
    };
    const handleBoardUpdated = (data) => {
      // 前の盤面と比べて置いた＋裏返った音を鳴らす
      const changed = countChanged(prevBoardRef.current, data.board);
      prevBoardRef.current = data.board;
      if (changed > 0) {
        playPlace();
        playFlips(changed - 1);
      }
      setGameState((prev) => ({
        ...prev,
        board: data.board,
        lastMove: data.lastMove,
        currentPlayer: data.currentPlayer,
        player1: data.player1,
        player2: data.player2,
      }));
    };
    const handleLegalMovesUpdated = (data) => setLegalMoves(data.legalMoves || []);
    const handleGameFinished = (data) => {
      const changed = countChanged(prevBoardRef.current, data.board);
      prevBoardRef.current = data.board;
      if (changed > 0) {
        playPlace();
        playFlips(changed - 1);
      }
      setGameState((prev) => ({
        ...prev,
        gameState: 'finished',
        board: data.board,
        winner: data.winner,
        player1: data.player1,
        player2: data.player2,
      }));
    };
    const handleOpponentDisconnected = () => {
      setError('相手が退出しました');
      setRematch('idle');
    };
    const handleRematchRequested = ({ by } = {}) => {
      if (by !== socket.id) setRematch((prev) => (prev === 'waiting' ? prev : 'offered'));
    };

    socket.on('game-started', handleGameStarted);
    socket.on('board-updated', handleBoardUpdated);
    socket.on('legal-moves-updated', handleLegalMovesUpdated);
    socket.on('game-finished', handleGameFinished);
    socket.on('opponent-disconnected', handleOpponentDisconnected);
    socket.on('rematch-requested', handleRematchRequested);

    socket.emit('get-game-state', { roomId }, (data) => {
      if (data && data.board) {
        prevBoardRef.current = data.board;
        setGameState(data);
        setLegalMoves(data.legalMoves || []);
        setLoading(false);
      }
    });

    return () => {
      socket.off('game-started', handleGameStarted);
      socket.off('board-updated', handleBoardUpdated);
      socket.off('legal-moves-updated', handleLegalMovesUpdated);
      socket.off('game-finished', handleGameFinished);
      socket.off('opponent-disconnected', handleOpponentDisconnected);
      socket.off('rematch-requested', handleRematchRequested);
    };
  }, [roomId, socket, router]);

  const handleCellClick = (row, col) => {
    unlockAudio();
    setLoading(true);
    socket.emit('place-piece', { roomId, row, col }, (response) => {
      setLoading(false);
      if (response && response.error) setError(response.error);
    });
  };

  const handleResign = () => {
    setLoading(true);
    socket.emit('resign', { roomId }, () => setLoading(false));
  };

  const handleLeaveRoom = () => {
    socket.emit('leave-room', { roomId });
    router.push('/');
  };

  const handleRematch = () => {
    unlockAudio();
    socket.emit('request-rematch', { roomId });
    setRematch('waiting');
  };

  if (loading && !gameState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-white/80 font-medium animate-pulse">読み込み中…</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6">
        <p className="text-white/80 font-medium">ゲーム情報を読み込めません</p>
        <button onClick={() => router.push('/')} className="btn btn-glass px-6 py-3">
          タイトルへ戻る
        </button>
      </div>
    );
  }

  const isPlaying = gameState.gameState === 'playing';
  const isFinished = gameState.gameState === 'finished';
  const myTurn = isPlaying && socket && gameState.currentPlayer === socket.id;
  const shownLegalMoves = myTurn ? legalMoves : [];

  return (
    <>
      <Head><title>対戦中 | Purple Reversi</title></Head>
      <div className="flex flex-col h-screen">
        {error && (
          <div className="glass-light rounded-2xl mx-4 mt-4 px-4 py-3 flex items-center justify-between text-sm text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-rose-500 hover:text-rose-700 px-2">
              ×
            </button>
          </div>
        )}

        <PlayerInfo
          player1={gameState.player1}
          player2={gameState.player2}
          currentPlayer={gameState.currentPlayer}
        />

        {isPlaying && (
          <>
            <div className="text-center mt-3">
              <span
                className={`inline-block text-sm font-semibold rounded-full px-4 py-1.5 transition-colors ${
                  myTurn ? 'bg-white text-violet-800' : 'text-white/60'
                }`}
              >
                {myTurn ? 'あなたの番' : '相手の番…'}
              </span>
            </div>
            <Timer isActive={true} onTimeUp={() => {}} initialTime={20} />
          </>
        )}

        <Board
          board={gameState.board}
          legalMoves={shownLegalMoves}
          lastMove={gameState.lastMove}
          onCellClick={handleCellClick}
        />

        <div className="px-4 pb-6">
          {isPlaying ? (
            <button onClick={handleResign} disabled={loading} className="btn btn-glass w-full py-3.5">
              投了する
            </button>
          ) : isFinished ? (
            <button onClick={handleLeaveRoom} className="btn btn-primary w-full py-3.5">
              タイトルに戻る
            </button>
          ) : null}
        </div>

        {isFinished && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="glass-light rounded-3xl p-7 max-w-sm w-full text-center animate-rise">
              <h2 className="wordmark text-2xl text-gray-900 mb-4">対局終了</h2>

              {gameState.winner === 'draw' ? (
                <p className="text-base font-semibold text-gray-800 mb-5">引き分けです</p>
              ) : (
                <p className="text-base font-semibold text-gray-800 mb-5">
                  {gameState.winner === gameState.player1?.id
                    ? `${gameState.player1?.name}（白）の勝ち`
                    : `${gameState.player2?.name}（紫）の勝ち`}
                </p>
              )}

              <div className="flex justify-center gap-10 mb-6">
                <div>
                  <p className="text-xs text-gray-400">白</p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    {gameState.player1?.pieces || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">紫</p>
                  <p className="text-3xl font-bold text-violet-600 tabular-nums">
                    {gameState.player2?.pieces || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {rematch === 'waiting' ? (
                  <div className="w-full py-3.5 rounded-full bg-violet-100 text-violet-700 font-semibold flex items-center justify-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    相手の返事を待っています…
                  </div>
                ) : rematch === 'offered' ? (
                  <button onClick={handleRematch} className="btn btn-violet w-full py-3.5">
                    相手が再戦希望！受けて対戦
                  </button>
                ) : (
                  <button onClick={handleRematch} className="btn btn-violet w-full py-3.5">
                    同じ相手ともう一度
                  </button>
                )}
                <button
                  onClick={handleLeaveRoom}
                  className="btn w-full py-3 bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  タイトルに戻る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
