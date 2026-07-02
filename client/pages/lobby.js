import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { initSocket } from '../lib/socket';
import { WaitingRoomCard, PlayingRoomCard } from '../components/RoomCard';

export default function LobbyPage() {
  const router = useRouter();
  const [waitingRooms, setWaitingRooms] = useState([]);
  const [playingRooms, setPlayingRooms] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socket = initSocket();

  // Socket接続とイベントリスナーの設定
  useEffect(() => {
    // Socket接続確認
    if (!socket.connected) {
      router.push('/');
      return;
    }

    // 初期ルームリスト取得
    socket.emit('get-rooms', (data) => {
      setWaitingRooms(data.waiting || []);
      setPlayingRooms(data.playing || []);
      setOnlineCount(data.onlineCount || 0);
    });

    // リアルタイムルーム更新リスナー
    const handleRoomsUpdated = (data) => {
      setWaitingRooms(data.waiting || []);
      setPlayingRooms(data.playing || []);
      setOnlineCount(data.onlineCount || 0);
    };

    socket.on('rooms-updated', handleRoomsUpdated);

    // クリーンアップ
    return () => {
      socket.off('rooms-updated', handleRoomsUpdated);
    };
  }, [socket, router]);

  // 部屋作成
  const handleCreateRoom = () => {
    setLoading(true);
    socket.emit('create-room', (response) => {
      setLoading(false);
      if (response && response.roomId) {
        router.push(`/game?roomId=${response.roomId}`);
      }
    });
  };

  // 部屋参加
  const handleJoinRoom = (roomId) => {
    setLoading(true);
    socket.emit('join-room', { roomId }, (response) => {
      setLoading(false);
      if (response && response.success && response.roomId) {
        router.push(`/game?roomId=${response.roomId}`);
      }
    });
  };

  // 手動更新
  const handleRefresh = () => {
    socket.emit('get-rooms', (data) => {
      setWaitingRooms(data.waiting || []);
      setPlayingRooms(data.playing || []);
      setOnlineCount(data.onlineCount || 0);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-purple-700 text-white py-4 px-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-2xl font-black text-white hover:opacity-80 transition-opacity cursor-pointer select-none"
          >
            Purple リバーシ
          </button>
          <h1 className="text-lg font-bold">{onlineCount}人待機中</h1>
        </div>
      </header>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 募集中セクション */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">募集中</h2>
          <div className="space-y-3">
            {waitingRooms.length > 0 ? (
              waitingRooms.map((room) => (
                <WaitingRoomCard
                  key={room.roomId}
                  room={room}
                  onJoin={handleJoinRoom}
                  loading={loading}
                />
              ))
            ) : (
              <p className="text-center text-sm text-gray-500">
                募集中の部屋はありません
              </p>
            )}
          </div>
        </section>

        {/* 対戦中セクション */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">対戦中</h2>
          <div className="space-y-3">
            {playingRooms.length > 0 ? (
              playingRooms.map((room, index) => (
                <PlayingRoomCard key={index} room={room} />
              ))
            ) : (
              <p className="text-center text-sm text-gray-500">
                対戦中の部屋はありません
              </p>
            )}
          </div>
        </section>
      </div>

      {/* フッター */}
      <footer className="border-t border-gray-200 bg-white p-4">
        <div className="space-y-3">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-green-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "接続中..." : "新しく部屋を作る"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-bold hover:bg-gray-400 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            更新
          </button>
        </div>
      </footer>
    </div>
  );
}
