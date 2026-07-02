import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import Papuko from '../components/Papuko';

export default function LobbyPage() {
  const router = useRouter();
  const [waitingRooms, setWaitingRooms] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [myRoomId, setMyRoomId] = useState(null);
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

    const handleGameStarted = () => {
      if (myRoomRef.current) router.push(`/game?roomId=${myRoomRef.current}`);
    };
    socket.on('game-started', handleGameStarted);

    return () => {
      socket.off('rooms-updated', applyRooms);
      socket.off('game-started', handleGameStarted);
      if (myRoomRef.current) socket.emit('leave-room', { roomId: myRoomRef.current });
    };
  }, [socket, router]);

  const handleWait = () => {
    if (busy || myRoomId) return;
    setBusy(true);
    socket.emit('create-room', (res) => {
      setBusy(false);
      if (res && res.roomId) setMyRoomId(res.roomId);
    });
  };

  const handleCancelWait = () => {
    if (!myRoomId) return;
    socket.emit('leave-room', { roomId: myRoomId });
    setMyRoomId(null);
  };

  const handleChallenge = (roomId) => {
    if (busy) return;
    setBusy(true);
    if (myRoomId && myRoomId !== roomId) {
      socket.emit('leave-room', { roomId: myRoomId });
      setMyRoomId(null);
    }
    socket.emit('join-room', { roomId }, (res) => {
      setBusy(false);
      if (res && res.success) router.push(`/game?roomId=${res.roomId || roomId}`);
    });
  };

  const refresh = () => {
    socket.emit('get-rooms', (data) => {
      setWaitingRooms(data.waiting || []);
      if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
    });
  };

  const others = waitingRooms.filter((r) => r.roomId !== myRoomId);

  return (
    <>
      <Head><title>対戦ロビー | Purple Reversi</title></Head>

      {/* コールドスタート待機オーバーレイ */}
      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center bg-[#2a0f4c]/75 backdrop-blur-sm">
          <Papuko size={100} float glow />
          <p className="text-white font-semibold text-lg">サーバーに接続中…</p>
          <p className="text-white/60 text-sm leading-relaxed">
            サーバーが眠っていると<br />
            初回は起動に最大50秒ほどかかります
          </p>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div className="flex flex-col h-screen">
        {/* ヘッダー */}
        <header className="sticky top-0 z-10 glass rounded-none px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Papuko size={32} />
            <span className="wordmark text-lg text-white">Purple Reversi</span>
          </button>
          <span className="text-xs font-semibold text-white/80 bg-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            {onlineCount}人
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {myRoomId && (
            <div className="glass-light rounded-3xl p-5 text-center mb-6 animate-rise">
              <p className="text-lg font-bold text-gray-900 mb-1">相手を待っています</p>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                このまま待つか、下の相手に挑戦してもOK。<br />
                誰かが「対戦する」を押すとすぐ始まります。
              </p>
              <div className="flex justify-center gap-1.5 mb-4">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <button onClick={handleCancelWait} className="btn w-full py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200">
                待機をやめる
              </button>
            </div>
          )}

          <h2 className="text-sm font-semibold text-white/60 tracking-wide mb-3 px-1">対戦できる相手</h2>
          <div className="space-y-2.5">
            {others.length > 0 ? (
              others.map((room, i) => (
                <div
                  key={room.roomId}
                  className={`glass rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-rise delay-${Math.min(i + 1, 4)}`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
                      style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(160deg,#a78bfa,#7c3aed)',
                        boxShadow: '0 4px 12px -4px rgba(124,58,237,0.7)',
                      }}
                    >
                      {(room.hostName || '?').slice(0, 1)}
                    </span>
                    <span className="font-semibold text-white truncate">
                      {room.hostName}
                      <span className="text-white/45 font-normal text-sm"> さん</span>
                    </span>
                  </span>
                  <button
                    onClick={() => handleChallenge(room.roomId)}
                    disabled={busy}
                    className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
                  >
                    対戦する
                  </button>
                </div>
              ))
            ) : (
              <div className="glass rounded-3xl p-8 text-center">
                <p className="text-white/80 mb-1">いま待っている人はいません</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  下の「相手を待つ」を押すと待機中になります。<br />
                  友達にこのページを教えてね。
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="px-4 pb-6 pt-2 space-y-2.5">
          {!myRoomId && (
            <button onClick={handleWait} disabled={busy} className="btn btn-primary w-full py-4 text-[17px]">
              相手を待つ
            </button>
          )}
          <button onClick={refresh} className="btn btn-glass w-full py-2.5 text-sm">
            更新
          </button>
        </footer>
      </div>
    </>
  );
}
