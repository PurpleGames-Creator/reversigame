import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import Papuko from '../components/Papuko';

export default function LobbyPage() {
  const router = useRouter();
  const [waitingRooms, setWaitingRooms] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [myRoomId, setMyRoomId] = useState(null); // 自分が相手を待っている部屋
  const [busy, setBusy] = useState(false);
  const socket = initSocket();
  const myRoomRef = useRef(null);

  useEffect(() => {
    myRoomRef.current = myRoomId;
  }, [myRoomId]);

  useEffect(() => {
    if (!socket.connected) {
      router.push('/');
      return;
    }

    const applyRooms = (data) => {
      setWaitingRooms(data.waiting || []);
      if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
    };

    socket.emit('get-rooms', applyRooms);
    socket.on('rooms-updated', applyRooms);

    // 自分が待機中に相手が入ってきたら対局へ
    const handleGameStarted = () => {
      if (myRoomRef.current) {
        router.push(`/game?roomId=${myRoomRef.current}`);
      }
    };
    socket.on('game-started', handleGameStarted);

    return () => {
      socket.off('rooms-updated', applyRooms);
      socket.off('game-started', handleGameStarted);
      // 待機中のまま離脱する場合は部屋を片付ける
      if (myRoomRef.current) {
        socket.emit('leave-room', { roomId: myRoomRef.current });
      }
    };
  }, [socket, router]);

  // 相手を待つ（部屋を作ってロビーに留まる）
  const handleWait = () => {
    if (busy || myRoomId) return;
    setBusy(true);
    socket.emit('create-room', (res) => {
      setBusy(false);
      if (res && res.roomId) setMyRoomId(res.roomId);
    });
  };

  // 待機をやめる
  const handleCancelWait = () => {
    if (!myRoomId) return;
    socket.emit('leave-room', { roomId: myRoomId });
    setMyRoomId(null);
  };

  // 相手に挑む
  const handleChallenge = (roomId) => {
    if (busy) return;
    setBusy(true);
    // 自分が待機中なら先に自分の部屋を畳む
    if (myRoomId && myRoomId !== roomId) {
      socket.emit('leave-room', { roomId: myRoomId });
      setMyRoomId(null);
    }
    socket.emit('join-room', { roomId }, (res) => {
      setBusy(false);
      if (res && res.success) {
        router.push(`/game?roomId=${res.roomId || roomId}`);
      }
    });
  };

  const others = waitingRooms.filter((r) => r.roomId !== myRoomId);

  return (
    <>
      <Head><title>対戦ロビー | Purple リバーシ</title></Head>
      <div className="flex flex-col h-screen text-white">
        {/* ヘッダー */}
        <header className="sticky top-0 z-10 bg-purple-800/80 backdrop-blur py-3 px-4 shadow-md flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 font-black text-lg hover:opacity-80"
          >
            <Papuko size={34} />
            Purple リバーシ
          </button>
          <span className="text-sm font-bold bg-white/15 rounded-full px-3 py-1">
            🟢 {onlineCount}人オンライン
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {/* 自分が待機中 */}
          {myRoomId && (
            <div className="mb-6 bg-yellow-300 text-purple-900 rounded-2xl p-5 text-center shadow-lg">
              <p className="text-lg font-black mb-1">相手を待っています…</p>
              <p className="text-sm mb-3">
                この画面のまま待つか、下の相手に挑戦してもOK。<br />
                誰かが「対戦する」を押すとすぐ始まります。
              </p>
              <div className="inline-block animate-pulse text-2xl mb-3">🟣 ⏳</div>
              <button
                onClick={handleCancelWait}
                className="block w-full bg-white/70 text-purple-900 rounded-xl py-2 font-bold hover:bg-white transition-colors"
              >
                待機をやめる
              </button>
            </div>
          )}

          {/* 待っている人 */}
          <h2 className="text-lg font-black mb-3 drop-shadow">対戦できる相手</h2>
          <div className="space-y-3">
            {others.length > 0 ? (
              others.map((room) => (
                <div
                  key={room.roomId}
                  className="bg-white text-gray-800 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">🟣</span>
                    <span className="font-bold truncate">
                      {room.hostName}
                      <span className="text-gray-400 font-normal">さん</span>
                    </span>
                  </span>
                  <button
                    onClick={() => handleChallenge(room.roomId)}
                    disabled={busy}
                    className="shrink-0 bg-purple-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                  >
                    {busy ? '…' : '対戦する'}
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white/10 border border-white/20 rounded-2xl p-6 text-center text-purple-100">
                <p className="mb-1">いま待っている人はいません。</p>
                <p className="text-sm">
                  下の「相手を待つ」を押すと、あなたが待機中になって<br />
                  相手が来るのを待てます。友達にこのページを教えてね！
                </p>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <footer className="bg-black/20 p-4 space-y-3">
          {!myRoomId && (
            <button
              onClick={handleWait}
              disabled={busy}
              className="w-full bg-yellow-300 text-purple-900 px-4 py-4 rounded-2xl font-black text-lg hover:bg-yellow-200 disabled:bg-gray-400 transition-colors"
            >
              🙌 相手を待つ（あなたが待機中になる）
            </button>
          )}
          <button
            onClick={() => socket.emit('get-rooms', (data) => {
              setWaitingRooms(data.waiting || []);
              if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
            })}
            className="w-full bg-white/15 border border-white/30 text-white px-4 py-2 rounded-xl font-bold hover:bg-white/25 transition-colors"
          >
            更新
          </button>
        </footer>
      </div>
    </>
  );
}
