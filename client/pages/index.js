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
      <Head><title>Purple リバーシ</title></Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white">
        {/* マスコット & タイトル */}
        <Papuko size={150} float />
        <h1 className="text-5xl font-black mt-4 drop-shadow-lg tracking-tight">
          Purple <span className="text-yellow-300">リバーシ</span>
        </h1>
        <p className="text-purple-200 mt-2 mb-10 text-sm">パプ子と、または世界の誰かと対戦しよう</p>

        <div className="w-full max-w-sm space-y-4">
          {/* CPU対戦（即プレイ） */}
          <button
            onClick={() => router.push('/cpu')}
            className="w-full bg-yellow-300 text-purple-900 rounded-2xl px-6 py-4 font-black text-lg shadow-lg hover:bg-yellow-200 transition-colors flex items-center justify-center gap-2"
          >
            🎮 パプ子と対戦（すぐ遊べる）
          </button>

          {/* オンライン対戦 */}
          {!showOnline ? (
            <button
              onClick={() => setShowOnline(true)}
              className="w-full bg-white/15 border-2 border-white/40 text-white rounded-2xl px-6 py-4 font-bold text-lg hover:bg-white/25 transition-colors"
            >
              🌐 オンライン対戦
              <span className="block text-xs font-normal text-purple-200 mt-0.5">
                {onlineCount}人が待機中
              </span>
            </button>
          ) : (
            <div className="bg-white/10 border-2 border-white/30 rounded-2xl p-4 space-y-3">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setLocalPlayerName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="プレイヤー名を入力"
                maxLength="20"
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3 bg-white/90 text-gray-800 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-50"
              />
              <button
                onClick={handleMatching}
                disabled={!playerName.trim() || loading}
                className={`w-full px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
                  playerName.trim() && !loading
                    ? 'bg-yellow-300 text-purple-900 hover:bg-yellow-200'
                    : 'bg-white/30 text-white/60 cursor-not-allowed'
                }`}
              >
                {loading ? '接続中…' : 'マッチングへ'}
              </button>
              {loading && !connected && (
                <p className="text-xs text-purple-100 text-center leading-relaxed">
                  サーバーを起こしています…<br />
                  初回は最大50秒ほどかかります（無料サーバーのため）
                </p>
              )}
              <p className="text-center text-xs text-purple-200">
                {onlineCount}人が待機中
              </p>
            </div>
          )}
        </div>

        <p className="mt-10 text-xs text-purple-300">Purple Games</p>
      </div>
    </>
  );
}
