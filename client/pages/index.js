import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import { getPlayerName, setPlayerName } from '../lib/storage';
import Papuko from '../components/Papuko';
import BoardBackdrop from '../components/BoardBackdrop';

function LockIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" fill="currentColor" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function TitleScreen() {
  const router = useRouter();
  const [playerName, setLocalPlayerName] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [panel, setPanel] = useState(null); // null | 'random' | 'private'
  const [privateCode, setPrivateCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchMode, setMatchMode] = useState('random'); // random | private
  const [spectateOpen, setSpectateOpen] = useState(false);
  const [liveGames, setLiveGames] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const socket = initSocket();

  // 入力欄がキーボードで隠れないよう、フォーカス時に見える位置へスクロール
  const handleFocus = (e) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  };

  useEffect(() => {
    const savedName = getPlayerName();
    if (savedName) setLocalPlayerName(savedName);

    setConnected(socket.connected);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleCount = (data) =>
      setOnlineCount(typeof data === 'number' ? data : data?.onlineCount ?? 0);
    const handleRooms = (data) => setLiveGames(data?.playing || []);
    const handleMatched = ({ roomId } = {}) => {
      if (roomId) router.push(`/game?roomId=${roomId}`);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online-count-updated', handleCount);
    socket.on('rooms-updated', handleRooms);
    socket.on('matched', handleMatched);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online-count-updated', handleCount);
      socket.off('rooms-updated', handleRooms);
      socket.off('matched', handleMatched);
    };
  }, [socket, router]);

  // 招待リンク（?join=あいことば）で開かれたら、プライベート戦を自動で開いて合言葉を入力
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const join = new URLSearchParams(window.location.search).get('join');
    if (join) {
      setPrivateCode(join.trim().slice(0, 32));
      setPanel('private');
    }
  }, []);

  // 招待リンクの URL を組み立てる（現在のパス＝basePath を維持）
  const buildInviteUrl = (code) => {
    if (typeof window === 'undefined') return '';
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?join=${encodeURIComponent(code)}`;
  };

  // 招待リンクをクリップボードへコピー（空なら合言葉を自動生成）
  const handleCopyInvite = async () => {
    let code = privateCode.trim();
    if (!code) {
      code = Math.random().toString(36).slice(2, 8); // 6文字の英数字
      setPrivateCode(code);
    }
    const url = buildInviteUrl(code);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      window.prompt('このリンクをコピーして友達に送ってください', url);
    }
  };

  // ランダム対戦
  const handleRandomMatch = () => {
    if (!playerName.trim() || loading || matching) return;
    setLoading(true);
    socket.emit('register', playerName.trim(), (res) => {
      if (res) {
        setPlayerName(playerName.trim());
        setLoading(false);
        setMatchMode('random');
        setMatching(true);
        socket.emit('find-match');
      } else {
        setLoading(false);
      }
    });
  };

  // プライベート戦（合言葉）
  const handlePrivateMatch = () => {
    const code = privateCode.trim();
    if (!playerName.trim() || !code || loading || matching) return;
    setLoading(true);
    socket.emit('register', playerName.trim(), (res) => {
      if (res) {
        setPlayerName(playerName.trim());
        setLoading(false);
        setMatchMode('private');
        setMatching(true);
        socket.emit('private-match', { code });
      } else {
        setLoading(false);
      }
    });
  };

  const handleCancelMatch = () => {
    if (matchMode === 'private') socket.emit('cancel-private', { code: privateCode.trim() });
    else socket.emit('cancel-match');
    setMatching(false);
  };

  const handleOpenSpectate = () => {
    setSpectateOpen(true);
    socket.emit('get-live-games', (res) => setLiveGames((res && res.games) || []));
  };
  const handleSpectate = (rid) => router.push(`/game?roomId=${rid}&spectate=1`);

  const inputsOpen = panel !== null;

  return (
    <>
      <Head><title>Purple Reversi</title></Head>

      {/* 観戦：進行中の対戦一覧 */}
      {spectateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2a0f4c]/75 backdrop-blur-sm">
          <div className="glass-light rounded-3xl p-6 max-w-sm w-full animate-rise">
            <h2 className="wordmark text-xl text-gray-900 mb-1 text-center">観戦する</h2>
            <p className="text-sm text-gray-500 mb-4 text-center">見たい対戦を選んでください</p>
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
              {liveGames.length > 0 ? (
                liveGames.map((g) => (
                  <button
                    key={g.roomId}
                    onClick={() => handleSpectate(g.roomId)}
                    className="w-full rounded-2xl px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      <span className="text-gray-900">{g.player1}</span>
                      <span className="text-gray-400 font-normal"> vs </span>
                      <span className="text-violet-700">{g.player2}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-white bg-violet-600 rounded-full px-3 py-1.5">
                      観戦
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500 py-8">
                  いま対戦中の試合はありません
                </p>
              )}
            </div>
            <button
              onClick={() => setSpectateOpen(false)}
              className="btn w-full py-3 mt-4 bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* マッチング待機ポップアップ */}
      {matching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2a0f4c]/75 backdrop-blur-sm">
          <div className="glass-light rounded-3xl p-8 max-w-xs w-full text-center animate-rise">
            <div className="flex justify-center mb-3">
              <Papuko size={96} float glow />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">相手を待っています</p>
            {matchMode === 'private' ? (
              <p className="text-sm text-gray-500 mb-1">
                あいことば：<span className="font-bold text-violet-700">{privateCode.trim()}</span>
              </p>
            ) : null}
            <p className="text-sm text-gray-500 mb-5">
              {connected
                ? matchMode === 'private'
                  ? '同じあいことばの友達を待っています'
                  : 'マッチングするまでお待ちください'
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
          inputsOpen ? 'justify-start pt-14 pb-[60vh]' : 'justify-center py-12'
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

          {/* アクション：2×2 グリッド */}
          <div className="w-full grid grid-cols-2 gap-3">
            {/* パプ子と対戦 */}
            <button
              onClick={() => router.push('/cpu')}
              className="btn-primary rounded-2xl flex flex-col items-center justify-center gap-1 py-6 transition-transform active:scale-[0.97] animate-rise delay-2"
            >
              <span className="text-[15px] font-semibold leading-tight">パプ子と対戦</span>
              <span className="text-[11px] font-medium text-violet-500/80">すぐ遊べる</span>
            </button>

            {/* ランダム対戦（タップでトグル） */}
            <button
              onClick={() => setPanel(panel === 'random' ? null : 'random')}
              className={`rounded-2xl flex flex-col items-center justify-center gap-1 py-6 transition-transform active:scale-[0.97] animate-rise delay-3 ${
                panel === 'random' ? 'btn-violet' : 'btn-glass'
              }`}
            >
              <span className="text-[15px] font-semibold leading-tight">ランダム対戦</span>
              <span className={`text-[11px] font-medium ${panel === 'random' ? 'text-white/80' : 'text-white/55'}`}>
                だれかと
              </span>
            </button>

            {/* プライベート戦（タップでトグル） */}
            <button
              onClick={() => setPanel(panel === 'private' ? null : 'private')}
              className={`rounded-2xl flex flex-col items-center justify-center gap-1 py-6 transition-transform active:scale-[0.97] animate-rise delay-3 ${
                panel === 'private' ? 'btn-violet' : 'btn-glass'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight">
                <LockIcon size={15} />
                プライベート戦
              </span>
              <span className={`text-[11px] font-medium ${panel === 'private' ? 'text-white/80' : 'text-white/55'}`}>
                あいことば
              </span>
            </button>

            {/* 観戦 */}
            <button
              onClick={handleOpenSpectate}
              className="btn-glass rounded-2xl flex flex-col items-center justify-center gap-1 py-6 transition-transform active:scale-[0.97] animate-rise delay-4"
            >
              <span className="text-[15px] font-semibold leading-tight">観戦する</span>
              <span className="text-[11px] font-medium text-white/55">試合を見る</span>
            </button>
          </div>

          {/* 展開パネル：グリッドの下に全幅で表示 */}
          {panel === 'random' && (
            <div className="w-full glass rounded-3xl p-4 space-y-3 mt-3 animate-rise">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setLocalPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleRandomMatch()}
                onFocus={handleFocus}
                placeholder="プレイヤー名を入力"
                maxLength="20"
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
              />
              <button
                onClick={handleRandomMatch}
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

          {panel === 'private' && (
            <div className="w-full glass rounded-3xl p-4 space-y-3 mt-3 animate-rise">
              <p className="text-xs text-white/70 leading-relaxed flex items-center gap-1.5">
                <LockIcon size={14} />
                友達と<span className="font-bold">同じあいことば</span>を入れて確定すると2人だけで対戦できます
              </p>
              <p className="text-[11px] text-white/50 leading-relaxed">
                招待リンクを送れば、相手はあいことば入力なしで参加できます
              </p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setLocalPlayerName(e.target.value)}
                onFocus={handleFocus}
                placeholder="プレイヤー名を入力"
                maxLength="20"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
              />
              <input
                type="text"
                value={privateCode}
                onChange={(e) => setPrivateCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePrivateMatch()}
                onFocus={handleFocus}
                placeholder="あいことば（数字や文字）"
                maxLength="32"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
              />
              <button
                onClick={handlePrivateMatch}
                disabled={!playerName.trim() || !privateCode.trim() || loading}
                className="btn btn-violet w-full py-3.5 text-base"
              >
                {loading ? '接続中…' : '確定'}
              </button>
              <button
                type="button"
                onClick={handleCopyInvite}
                disabled={loading}
                className="btn btn-glass w-full py-2.5 text-sm disabled:opacity-50"
              >
                {linkCopied ? '✓ リンクをコピーしました' : '招待リンクをコピー'}
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
      </main>
    </>
  );
}
