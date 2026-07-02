import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import { getPlayerName, setPlayerName } from '../lib/storage';
import Papuko from '../components/Papuko';
import BoardBackdrop from '../components/BoardBackdrop';

export default function TitleScreen() {
  const router = useRouter();
  const [playerName, setLocalPlayerName] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [matching, setMatching] = useState(false);
  const socket = initSocket();
  const inputRef = useRef(null);

  // キーボードで隠れないよう、フォーカス時に入力欄を見える位置へスクロール
  const handleInputFocus = () => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  };

  useEffect(() => {
    const savedName = getPlayerName();
    if (savedName) setLocalPlayerName(savedName);

    setConnected(socket.connected);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleCount = (data) =>
      setOnlineCount(typeof data === 'number' ? data : data?.onlineCount ?? 0);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online-count-updated', handleCount);

    // マッチング成立 → 対局画面へ
    const handleMatched = ({ roomId } = {}) => {
      if (roomId) router.push(`/game?roomId=${roomId}`);
    };
    socket.on('matched', handleMatched);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online-count-updated', handleCount);
      socket.off('matched', handleMatched);
    };
  }, [socket, router]);

  // ランダムマッチング開始（登録→待機列へ）
  const handleMatching = () => {
    if (!playerName.trim() || loading || matching) return;
    setLoading(true);
    socket.emit('register', playerName, (res) => {
      if (res) {
        setPlayerName(playerName);
        setLoading(false);
        setMatching(true);
        socket.emit('find-match');
      } else {
        setLoading(false);
      }
    });
  };

  const handleCancelMatch = () => {
    socket.emit('cancel-match');
    setMatching(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleMatching();
  };

  return (
    <>
      <Head><title>Purple Reversi</title></Head>

      {/* マッチング待機ポップアップ */}
      {matching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2a0f4c]/75 backdrop-blur-sm">
          <div className="glass-light rounded-3xl p-8 max-w-xs w-full text-center animate-rise">
            <div className="flex justify-center mb-3">
              <Papuko size={96} float glow />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">相手を待っています</p>
            <p className="text-sm text-gray-500 mb-5">
              {connected
                ? 'マッチングするまでお待ちください'
                : 'サーバーを起動中…最大50秒ほどかかります'}
            </p>
            <div className="flex justify-center gap-2 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <button
              onClick={handleCancelMatch}
              className="btn w-full py-3 bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              待機をやめる
            </button>
          </div>
        </div>
      )}

      <main
        className={`min-h-screen [min-height:100dvh] flex flex-col items-center px-6 ${
          showOnline ? 'justify-start pt-14 pb-[60vh]' : 'justify-center py-12'
        }`}
      >
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* マスコット＋背景のリバーシ盤 */}
          <div className="relative animate-rise" style={{ width: 300, height: 300 }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <BoardBackdrop size={300} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Papuko size={156} float glow />
            </div>
          </div>

          {/* タイトル */}
          <p className="eyebrow text-[11px] mt-8 mb-3 animate-rise delay-1">Purple Games</p>
          <h1 className="wordmark text-5xl text-white text-center animate-rise delay-1">
            Purple Reversi
          </h1>
          <p className="mt-3 mb-10 text-[15px] text-white/70 flex items-center gap-2 animate-rise delay-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            {onlineCount}人がオンライン
          </p>

          {/* アクション */}
          <div className="w-full space-y-3">
            <button
              onClick={() => router.push('/cpu')}
              className="btn btn-primary w-full py-4 text-[17px] animate-rise delay-2"
            >
              パプ子と対戦
            </button>

            {!showOnline ? (
              <button
                onClick={() => setShowOnline(true)}
                className="btn btn-glass w-full py-4 text-[17px] animate-rise delay-3"
              >
                オンライン対戦
              </button>
            ) : (
              <div className="glass rounded-3xl p-4 space-y-3 animate-rise">
                <input
                  ref={inputRef}
                  type="text"
                  value={playerName}
                  onChange={(e) => setLocalPlayerName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={handleInputFocus}
                  placeholder="プレイヤー名を入力"
                  maxLength="20"
                  disabled={loading}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
                />
                <button
                  onClick={handleMatching}
                  disabled={!playerName.trim() || loading}
                  className="btn btn-violet w-full py-3.5 text-base"
                >
                  {loading ? '接続中…' : '待機ロビーへ'}
                </button>
                {loading && !connected && (
                  <p className="text-xs text-white/60 text-center leading-relaxed">
                    サーバーを起こしています…<br />
                    初回は最大50秒ほどかかります
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
