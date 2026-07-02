import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import { getPlayerName, setPlayerName } from '../lib/storage';
import Papuko from '../components/Papuko';

export default function TitleScreen() {
  const router = useRouter();
  const [playerName, setLocalPlayerName] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const socket = initSocket();

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

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online-count-updated', handleCount);
    };
  }, [socket]);

  const handleMatching = () => {
    if (!playerName.trim() || loading) return;
    setLoading(true);
    socket.emit('register', playerName, (success) => {
      if (success) {
        setPlayerName(playerName);
        router.push('/lobby');
      } else {
        setLoading(false);
      }
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleMatching();
  };

  return (
    <>
      <Head><title>Purple Reversi</title></Head>
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* マスコット */}
          <div className="animate-rise">
            <Papuko size={168} float glow />
          </div>

          {/* タイトル */}
          <p className="eyebrow text-[11px] mt-8 mb-3 animate-rise delay-1">Purple Games</p>
          <h1 className="wordmark text-5xl text-white text-center animate-rise delay-1">
            Purple Reversi
          </h1>
          <p className="text-white/55 mt-3 mb-10 text-[15px] animate-rise delay-2">
            シンプルな対戦リバーシ
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
                className="btn btn-glass w-full py-4 text-[17px] flex-col gap-0 animate-rise delay-3"
              >
                <span>オンライン対戦</span>
                <span className="text-xs font-normal text-white/55 mt-0.5">
                  {onlineCount}人がオンライン
                </span>
              </button>
            ) : (
              <div className="glass rounded-3xl p-4 space-y-3 animate-rise">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setLocalPlayerName(e.target.value)}
                  onKeyPress={handleKeyPress}
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
                  {loading ? '接続中…' : 'マッチングへ'}
                </button>
                {loading && !connected && (
                  <p className="text-xs text-white/60 text-center leading-relaxed">
                    サーバーを起こしています…<br />
                    初回は最大50秒ほどかかります
                  </p>
                )}
                <p className="text-center text-xs text-white/45">
                  {onlineCount}人がオンライン
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
