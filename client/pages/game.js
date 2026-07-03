import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import Board from '../components/Board';
import PlayerInfo from '../components/PlayerInfo';
import Timer from '../components/Timer';
import { playPlace, playFlips, unlockAudio } from '../lib/sound';

// 切断した相手の復帰待ちカウントダウン（秒）
function GraceCountdown({ until }) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(
      () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))),
      250
    );
    return () => clearInterval(t);
  }, [until]);
  return <span className="font-bold tabular-nums">{left}</span>;
}

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
  const isSpectator = router.query.spectate === '1';
  const [gameState, setGameState] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rematch, setRematch] = useState('idle'); // idle | waiting | offered
  const [deadline, setDeadline] = useState(null); // 手番の締切（ローカル時計基準のエポックms）
  const [notice, setNotice] = useState(null); // パス・時間切れなどの一時通知
  const [connLost, setConnLost] = useState(false); // 自分の接続が切れた（再接続中）
  const [graceUntil, setGraceUntil] = useState(null); // 相手の復帰待ち締切
  const [graceName, setGraceName] = useState(null); // 復帰待ちのプレイヤー名
  const [opponentGone, setOpponentGone] = useState(false); // 相手が完全に退出済み
  const prevBoardRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const socket = initSocket();

  // 観戦側もどこかを触れば音が有効化されるように
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);

    // 未接続でもすぐ諦めない（リロード直後や再接続中は connect 後に rejoin する）。
    // 一定時間つながらなければ「読み込めません」画面へ。
    const bootTimeout = setTimeout(() => setLoading(false), 20000);

    // サーバーの残り時間(ms)をローカルの締切時刻へ変換（時計ズレの影響を受けない）
    const syncDeadline = (data) =>
      setDeadline(
        typeof data?.turnRemaining === 'number' ? Date.now() + data.turnRemaining : null
      );

    // 2.6秒だけ表示する一時通知（パス・時間切れ）
    const showNotice = (text) => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      setNotice(text);
      noticeTimerRef.current = setTimeout(() => setNotice(null), 2600);
    };

    const handleGameStarted = (data) => {
      prevBoardRef.current = data.board;
      setGameState(data);
      setRematch('idle');
      setError(null);
      setNotice(null);
      setGraceUntil(null);
      setOpponentGone(false);
      syncDeadline(data);
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
      syncDeadline(data);
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
      setDeadline(null);
      setGraceUntil(null);
    };
    const handleOpponentDisconnected = () => {
      setError(isSpectator ? 'この対戦は終了しました' : '相手が退出しました');
      setRematch('idle');
      setDeadline(null);
      setGraceUntil(null);
      setOpponentGone(true);
    };
    const handleRematchRequested = ({ by } = {}) => {
      if (by !== socket.id) setRematch((prev) => (prev === 'waiting' ? prev : 'offered'));
    };
    const handleOpponentConnLost = ({ graceMs, playerName } = {}) => {
      setGraceUntil(Date.now() + (graceMs || 30000));
      setGraceName(playerName || '相手');
      setDeadline(null); // 復帰待ちの間は手番タイマーも止まっている
    };
    const handleOpponentReconnected = ({ playerName } = {}) => {
      setGraceUntil(null);
      showNotice(`${playerName || '相手'} が復帰しました`);
    };
    // 自分の接続が切れた → オーバーレイを出し、復帰したら対局へ再参加
    const handleDisconnect = () => {
      setConnLost(true);
      setDeadline(null);
    };
    const handleReconnect = () => {
      if (isSpectator) {
        socket.emit('spectate', { roomId }, (res) => {
          setConnLost(false);
          setLoading(false);
          if (res && res.success && res.state && res.state.board) {
            prevBoardRef.current = res.state.board;
            setGameState(res.state);
            syncDeadline(res.state);
            setError(null);
          } else {
            setError((res && res.error) || 'この対戦は終了しました');
          }
        });
      } else {
        socket.emit('rejoin-room', { roomId }, (res) => {
          setConnLost(false);
          setLoading(false);
          if (res && res.success && res.state && res.state.board) {
            prevBoardRef.current = res.state.board;
            setGameState(res.state);
            setLegalMoves(res.legalMoves || []);
            syncDeadline(res.state);
            setError(null);
          } else {
            setError((res && res.error) || '対局に戻れませんでした');
          }
        });
      }
    };
    const handleTurnPassed = ({ playerId, playerName } = {}) => {
      showNotice(
        playerId === socket.id
          ? '置ける場所がないのでパス'
          : `${playerName || '相手'} は置ける場所がないのでパス`
      );
    };
    const handleTurnTimeout = ({ playerId } = {}) => {
      showNotice(
        playerId === socket.id
          ? '時間切れ！自動で打たれました'
          : '相手が時間切れ：自動で打たれました'
      );
    };

    socket.on('game-started', handleGameStarted);
    socket.on('board-updated', handleBoardUpdated);
    socket.on('legal-moves-updated', handleLegalMovesUpdated);
    socket.on('game-finished', handleGameFinished);
    socket.on('opponent-disconnected', handleOpponentDisconnected);
    socket.on('rematch-requested', handleRematchRequested);
    socket.on('turn-passed', handleTurnPassed);
    socket.on('turn-timeout', handleTurnTimeout);
    socket.on('opponent-connection-lost', handleOpponentConnLost);
    socket.on('opponent-reconnected', handleOpponentReconnected);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleReconnect);

    if (socket.connected) {
      if (isSpectator) {
        // 観戦：プレイヤーにはならずルームに参加して状態を取得
        socket.emit('spectate', { roomId }, (res) => {
          if (res && res.success && res.state && res.state.board) {
            prevBoardRef.current = res.state.board;
            setGameState(res.state);
            syncDeadline(res.state);
            setLoading(false);
          } else {
            setError((res && res.error) || 'その対戦は見つかりません');
            setLoading(false);
          }
        });
      } else {
        socket.emit('get-game-state', { roomId }, (data) => {
          if (data && data.board) {
            prevBoardRef.current = data.board;
            setGameState(data);
            setLegalMoves(data.legalMoves || []);
            syncDeadline(data);
            setLoading(false);
          }
        });
      }
    }
    // 未接続の場合は 'connect' → handleReconnect が rejoin/spectate で状態を取得する

    return () => {
      socket.off('game-started', handleGameStarted);
      socket.off('board-updated', handleBoardUpdated);
      socket.off('legal-moves-updated', handleLegalMovesUpdated);
      socket.off('game-finished', handleGameFinished);
      socket.off('opponent-disconnected', handleOpponentDisconnected);
      socket.off('rematch-requested', handleRematchRequested);
      socket.off('turn-passed', handleTurnPassed);
      socket.off('turn-timeout', handleTurnTimeout);
      socket.off('opponent-connection-lost', handleOpponentConnLost);
      socket.off('opponent-reconnected', handleOpponentReconnected);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleReconnect);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      clearTimeout(bootTimeout);
    };
  }, [roomId, socket, router, isSpectator]);

  const handleCellClick = (row, col) => {
    if (isSpectator) return;
    unlockAudio();
    setLoading(true);
    socket.emit('place-piece', { roomId, row, col }, (response) => {
      setLoading(false);
      if (response && response.error) setError(response.error);
    });
  };

  const handleExitSpectate = () => {
    socket.emit('leave-spectate', { roomId });
    router.push('/');
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
      <div className="flex items-center justify-center h-screen [height:100dvh]">
        <p className="text-white/80 font-medium animate-pulse">読み込み中…</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen [height:100dvh] gap-4 px-6">
        <p className="text-white/80 font-medium">{error || 'ゲーム情報を読み込めません'}</p>
        <button onClick={() => router.push('/')} className="btn btn-glass px-6 py-3">
          タイトルへ戻る
        </button>
      </div>
    );
  }

  const isPlaying = gameState.gameState === 'playing';
  const isFinished = gameState.gameState === 'finished';
  const myTurn = isPlaying && !isSpectator && socket && gameState.currentPlayer === socket.id;
  const shownLegalMoves = myTurn ? legalMoves : [];
  const currentName =
    gameState.currentPlayer === gameState.player1?.id
      ? gameState.player1?.name
      : gameState.player2?.name;

  return (
    <>
      <Head><title>{isSpectator ? '観戦中' : '対戦中'} | Purple Reversi</title></Head>
      <div className="flex flex-col h-screen [height:100dvh]">
        {error && (
          <div className="glass-light rounded-2xl mx-4 mt-4 px-4 py-3 flex items-center justify-between text-sm text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-rose-500 hover:text-rose-700 px-2">
              ×
            </button>
          </div>
        )}

        {/* 相手の復帰待ちカウントダウン */}
        {graceUntil && !error && (
          <div className="glass rounded-2xl mx-4 mt-4 px-4 py-3 text-center text-sm text-white/90">
            {graceName || '相手'} の接続が切れました。復帰を待っています…{' '}
            <GraceCountdown until={graceUntil} /> 秒
          </div>
        )}

        <PlayerInfo
          player1={gameState.player1}
          player2={gameState.player2}
          currentPlayer={gameState.currentPlayer}
        />

        {isPlaying && isSpectator && (
          <div className="text-center mt-3 flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-white/50 bg-white/10 rounded-full px-3 py-1">
              観戦中
            </span>
            {notice ? (
              <span className="text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                {notice}
              </span>
            ) : (
              <span className="text-sm font-semibold text-white/80">
                {currentName} の番
              </span>
            )}
            <Timer deadline={deadline} />
          </div>
        )}

        {isPlaying && !isSpectator && (
          <>
            <div className="text-center mt-3">
              {notice ? (
                <span className="inline-block text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                  {notice}
                </span>
              ) : (
                <span
                  className={`inline-block text-sm font-semibold rounded-full px-4 py-1.5 transition-colors ${
                    myTurn ? 'bg-white text-violet-800' : 'text-white/60'
                  }`}
                >
                  {myTurn ? 'あなたの番' : '相手の番…'}
                </span>
              )}
            </div>
            <Timer deadline={deadline} />
          </>
        )}

        <Board
          board={gameState.board}
          legalMoves={shownLegalMoves}
          lastMove={gameState.lastMove}
          onCellClick={handleCellClick}
        />

        <div className="px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          {isSpectator ? (
            <button onClick={handleExitSpectate} className="btn btn-glass w-full py-3.5">
              観戦をやめる
            </button>
          ) : isPlaying ? (
            <button onClick={handleResign} disabled={loading} className="btn btn-glass w-full py-3.5">
              投了する
            </button>
          ) : isFinished ? (
            <button onClick={handleLeaveRoom} className="btn btn-primary w-full py-3.5">
              タイトルに戻る
            </button>
          ) : null}
        </div>

        {/* 自分の接続が切れた：再接続オーバーレイ */}
        {connLost && (
          <div className="fixed inset-0 bg-[#2a0f4c]/80 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
            <div className="glass-light rounded-3xl p-7 max-w-xs w-full text-center animate-rise">
              <p className="text-base font-bold text-gray-900 mb-1">接続が切れました</p>
              <p className="text-sm text-gray-500 mb-4">再接続しています…</p>
              <div className="flex justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

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
                {isSpectator ? (
                  <button onClick={handleExitSpectate} className="btn btn-violet w-full py-3.5">
                    観戦を終える
                  </button>
                ) : opponentGone ? (
                  <p className="text-sm text-gray-500 py-2">相手は退出しました</p>
                ) : rematch === 'waiting' ? (
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
                {!isSpectator && (
                  <button
                    onClick={handleLeaveRoom}
                    className="btn w-full py-3 bg-gray-100 text-gray-800 hover:bg-gray-200"
                  >
                    タイトルに戻る
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
