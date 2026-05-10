import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { initSocket } from '../lib/socket';
import { getPlayerName, setPlayerName } from '../lib/storage';

export default function TitleScreen() {
  const router = useRouter();
  const [playerName, setLocalPlayerName] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socket = initSocket();

  useEffect(() => {
    // Load saved player name from storage
    const savedName = getPlayerName();
    if (savedName) {
      setLocalPlayerName(savedName);
    }

    // Listen to online count updates
    socket.on('online-count-updated', (count) => {
      setOnlineCount(count);
    });

    // Cleanup
    return () => {
      socket.off('online-count-updated');
    };
  }, [socket]);

  const handleInputChange = (e) => {
    setLocalPlayerName(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleMatching();
    }
  };

  const handleMatching = () => {
    if (!playerName.trim() || loading) {
      return;
    }

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

  return (
    <div className="w-full h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex items-center justify-center">
      <div className="text-center">
        {/* Title */}
        <h1 className="text-6xl font-bold text-white mb-4">リバーシ</h1>

        {/* Subtitle */}
        <p className="text-2xl text-blue-100 mb-8">オンライン対戦</p>

        {/* Online count */}
        <p className="text-xl text-blue-200 mb-12">{onlineCount}人待機中</p>

        {/* Player name input */}
        <div className="mb-6">
          <input
            type="text"
            value={playerName}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="プレイヤー名を入力"
            maxLength="20"
            disabled={loading}
            className="px-4 py-3 w-64 bg-transparent border-2 border-white text-white placeholder-blue-200 rounded-lg focus:outline-none focus:border-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Matching button */}
        <button
          onClick={handleMatching}
          disabled={!playerName.trim() || loading}
          className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${
            playerName.trim() && !loading
              ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 cursor-pointer'
              : 'bg-gray-400 text-gray-700 cursor-not-allowed'
          }`}
        >
          {loading ? 'マッチング中...' : 'マッチングへ'}
        </button>
      </div>
    </div>
  );
}
