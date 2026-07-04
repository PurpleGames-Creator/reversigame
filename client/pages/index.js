import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { initSocket } from '../lib/socket';
import { getPlayerName, setPlayerName } from '../lib/storage';
import Papuko from '../components/Papuko';
import BoardBackdrop from '../components/BoardBackdrop';
import SoundToggle from '../components/SoundToggle';

function LockIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" fill="currentColor" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// オンライン対戦（ランダムマッチ）の開催時間: 毎日21:00〜24:00 JST
const isOnlineHours = () => (new Date().getUTCHours() + 9) % 24 >= 21;
// 次の開催（JST 21:00）までの残りミリ秒（開催中は0）
const msUntilOpen = () => {
  const jstNowMs = Date.now() + 9 * 3600e3;
  const jstHour = Math.floor(jstNowMs / 3600e3) % 24;
  if (jstHour >= 21) return 0;
  const jstDayStart = Math.floor(jstNowMs / 86400e3) * 86400e3;
  return jstDayStart + 21 * 3600e3 - jstNowMs;
};

// 閉場15分前からのカウントダウン（開催中のみ・23:45から表示）
function ClosingNotice() {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const tick = () => {
      const jstMs = Date.now() + 9 * 3600e3;
      const h = Math.floor(jstMs / 3600e3) % 24;
      const untilMidnight = 86400e3 - (jstMs % 86400e3);
      setLeft(h >= 21 && untilMidnight <= 15 * 60e3 ? untilMidnight : null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (left == null) return null;
  const s = Math.max(0, Math.floor(left / 1000));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return (
    <p className="text-[12px] font-bold text-amber-300 animate-pulse">
      ⏰ 閉場まで あと {m}:{sec}
    </p>
  );
}

// 開催までのカウントダウン（1秒ごと更新・H:MM:SS）。0になったら onZero を一度だけ呼ぶ
function OpenCountdown({ onZero }) {
  const [left, setLeft] = useState(msUntilOpen());
  const firedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setLeft(msUntilOpen()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0 && !firedRef.current) {
      firedRef.current = true;
      if (onZero) onZero();
    }
  }, [left, onZero]);
  const s = Math.max(0, Math.floor(left / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return (
    <span className="font-bold text-violet-700 tabular-nums">
      {h}:{m}:{sec}
    </span>
  );
}

// タイトルのパプ子をタップした時のセリフ（ツンデレ）
const PAPUKO_TAP_LINES = [
  'な、なに？ 対戦したいの？',
  'べ、別にあなたを待ってたわけじゃないし',
  'ふふん、私に勝てると思ってるの？',
  '…あんまりつつかないでよね',
  '勝負しないなら帰っていいのよ？',
  'ひまなの？ …まあ、私もだけど',
];
// レア（低確率）
const PAPUKO_RARE_LINE = '……ちょっとだけ、来るの待ってた';

// 数値が変わったら現在の表示値からカウントアップ/ダウンして追いつくアニメーション
function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  useEffect(() => {
    if (displayRef.current === target) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out
      const val = Math.round(from + (target - from) * eased);
      displayRef.current = val;
      setDisplay(val);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

export default function TitleScreen() {
  const router = useRouter();
  const [playerName, setLocalPlayerName] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  // サーバーは接続中の全クライアント数を配信するので、自分の1人分を引いて表示
  const shownOnline = useCountUp(Math.max(0, onlineCount - 1));
  const [papukoTap, setPapukoTap] = useState(null); // {text, key}
  const papukoTapTimerRef = useRef(null);
  const lastTapLineRef = useRef(-1);

  // パプ子タップ：ぴょこんと跳ねてツンデレの一言（同じセリフの連続は避ける）
  const handlePapukoTap = () => {
    let text;
    if (Math.random() < 0.08) {
      text = PAPUKO_RARE_LINE;
    } else {
      let i;
      do {
        i = Math.floor(Math.random() * PAPUKO_TAP_LINES.length);
      } while (i === lastTapLineRef.current);
      lastTapLineRef.current = i;
      text = PAPUKO_TAP_LINES[i];
    }
    if (papukoTapTimerRef.current) clearTimeout(papukoTapTimerRef.current);
    setPapukoTap({ text, key: Date.now() });
    papukoTapTimerRef.current = setTimeout(() => setPapukoTap(null), 2600);
  };
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [panel, setPanel] = useState(null); // null | 'random' | 'private'
  const [privateCode, setPrivateCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchMode, setMatchMode] = useState('random'); // random | private
  const [matchPhase, setMatchPhase] = useState('searching'); // searching | found | preparing
  const matchTimersRef = useRef([]);
  const [spectateOpen, setSpectateOpen] = useState(false);
  const [liveGames, setLiveGames] = useState([]);
  const [onlineOpen, setOnlineOpen] = useState(true); // 開催時間内か（初期はSSR差異回避でtrue）
  const [hoursOpen, setHoursOpen] = useState(false); // 開催時間の案内ポップアップ
  const [champion, setChampion] = useState(null); // 夜間王者 {name, wins}

  const [justOpened, setJustOpened] = useState(false); // 開場直後のボタン光り演出

  // 開催時間の判定を1秒ごとに更新（21:00ちょうどに自動でロック解除）
  // 開場の瞬間: 前夜の王者表示をクリア＋案内ポップアップを閉じ＋ボタンを数秒光らせる
  const prevOpenRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    let glowTimer;
    const update = () => {
      const open = isOnlineHours();
      if (open && !prevOpenRef.current) {
        setChampion(null);
        setHoursOpen(false);
        // 初回マウント時（もともと開催中）は光らせない。21:00をまたいだ時だけ
        if (prevOpenRef.current === false && mountedRef.current) {
          setJustOpened(true);
          glowTimer = setTimeout(() => setJustOpened(false), 4000);
        }
      }
      prevOpenRef.current = open;
      mountedRef.current = true;
      setOnlineOpen(open);
    };
    update();
    const t = setInterval(update, 1000);
    return () => {
      clearInterval(t);
      if (glowTimer) clearTimeout(glowTimer);
    };
  }, []);
  const [linkCopied, setLinkCopied] = useState(false);
  const socket = initSocket();

  // 入力欄がキーボードで隠れないよう、フォーカス時に見える位置へスクロール
  const handleFocus = (e) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  };

  // Render(Free)はスリープするので、トップを開いた時点で /health を叩いて起こしておく。
  // socket接続も裏で走るが、fetchの方が確実に即リクエストが飛ぶ（プリウォーム）
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://purple-reversi.onrender.com';
    fetch(`${base}/health`).catch(() => {});
  }, []);

  useEffect(() => {
    const savedName = getPlayerName();
    if (savedName) setLocalPlayerName(savedName);

    setConnected(socket.connected);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleCount = (data) =>
      setOnlineCount(typeof data === 'number' ? data : data?.onlineCount ?? 0);
    const handleRooms = (data) => setLiveGames(data?.playing || []);
    const handleChampion = (data) => {
      setChampion(data && data.name ? { name: data.name, wins: data.wins } : null);
    };
    // マッチ成立：即遷移せず「相手が見つかりました→マッチング中」と進捗を見せてから対局へ
    const handleMatched = ({ roomId } = {}) => {
      if (!roomId) return;
      setMatchPhase('found');
      matchTimersRef.current.forEach(clearTimeout);
      matchTimersRef.current = [
        setTimeout(() => setMatchPhase('preparing'), 900),
        setTimeout(() => router.push(`/game?roomId=${roomId}`), 1700),
      ];
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online-count-updated', handleCount);
    socket.on('rooms-updated', handleRooms);
    socket.on('matched', handleMatched);
    socket.on('night-champion', handleChampion);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online-count-updated', handleCount);
      socket.off('rooms-updated', handleRooms);
      socket.off('matched', handleMatched);
      socket.off('night-champion', handleChampion);
      matchTimersRef.current.forEach(clearTimeout);
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

  // オンライン対戦（ランダムマッチ・毎日21:00〜24:00限定）
  const handleRandomMatch = () => {
    if (!playerName.trim() || loading || matching) return;
    if (!isOnlineHours()) {
      setHoursOpen(true);
      return;
    }
    setLoading(true);
    socket.emit('register', playerName.trim(), (res) => {
      if (res && res.success) {
        setPlayerName(playerName.trim());
        setLoading(false);
        setMatchMode('random');
        setMatchPhase('searching');
        setMatching(true);
        // サーバー側の時間ガードに弾かれたら案内を出す（時計ズレ等の保険）
        socket.emit('find-match', (res2) => {
          if (res2 && res2.success === false) {
            setMatching(false);
            setHoursOpen(true);
          }
        });
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
      if (res && res.success) {
        setPlayerName(playerName.trim());
        setLoading(false);
        setMatchMode('private');
        setMatchPhase('searching');
        setMatching(true);
        socket.emit('private-match', { code });
      } else {
        setLoading(false);
      }
    });
  };

  const handleCancelMatch = () => {
    if (matchPhase !== 'searching') return; // マッチ成立後はキャンセル不可
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
      <SoundToggle />

      {/* Purple Park ロゴ（タップでホームページへ） */}
      <a
        href="https://purple-park.vercel.app/"
        aria-label="Purple Park ホームページへ"
        className="fixed z-40 transition-opacity hover:opacity-80 active:scale-95"
        style={{
          top: 'max(0.9rem, env(safe-area-inset-top))',
          left: 'max(0.9rem, env(safe-area-inset-left))',
        }}
      >
        <img
          src={`${router.basePath}/park-logo.png`}
          alt="Purple Park"
          className="h-9 w-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
        />
      </a>

      {/* 観戦：進行中の対戦一覧。カードは固定高＝一覧が増減しても「閉じる」の位置が動かない */}
      {spectateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2a0f4c]/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSpectateOpen(false); // 背景タップでも閉じる
          }}
        >
          <div
            className="glass-light rounded-3xl p-6 max-w-sm w-full animate-rise flex flex-col"
            style={{ height: 'min(26rem, 78vh)' }}
          >
            <h2 className="wordmark text-xl text-gray-900 mb-1 text-center">観戦する</h2>
            <p className="text-sm text-gray-500 mb-4 text-center h-5">
              {liveGames.length > 0 ? '見たい対戦を選んでください' : ''}
            </p>
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {liveGames.length > 0 ? (
                liveGames.map((g) => {
                  const stage =
                    typeof g.moves === 'number'
                      ? g.moves <= 15
                        ? '序盤'
                        : g.moves <= 40
                          ? '中盤'
                          : '終盤'
                      : null;
                  return (
                    <button
                      key={g.roomId}
                      onClick={() => handleSpectate(g.roomId)}
                      className="w-full rounded-2xl px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-semibold text-gray-800 truncate">
                          <span className="text-gray-900">{g.player1}</span>
                          {typeof g.pieces1 === 'number' && (
                            <span className="tabular-nums text-gray-700"> {g.pieces1}</span>
                          )}
                          <span className="text-gray-400 font-normal"> vs </span>
                          {typeof g.pieces2 === 'number' && (
                            <span className="tabular-nums text-violet-600">{g.pieces2} </span>
                          )}
                          <span className="text-violet-700">{g.player2}</span>
                        </span>
                        {stage && (
                          <span className="block text-[11px] text-gray-400 tabular-nums">
                            {g.moves}手目・{stage}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-white bg-violet-600 rounded-full px-3 py-1.5">
                        観戦
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-sm text-gray-500">
                    いま対戦中の試合はありません
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSpectateOpen(false)}
              className="btn w-full py-3 mt-4 bg-white text-gray-700 font-semibold border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* オンライン対戦の開催時間案内 */}
      {hoursOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2a0f4c]/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHoursOpen(false);
          }}
        >
          <div className="glass-light rounded-3xl p-7 max-w-xs w-full text-center animate-rise">
            <p className="text-3xl mb-2">🌙</p>
            <h2 className="wordmark text-xl text-gray-900 mb-2">オンライン対戦</h2>
            <p className="text-sm text-gray-600 mb-1">
              毎日 <span className="font-bold text-violet-700">21:00〜24:00</span> に開催中！
            </p>
            <p className="text-sm text-gray-500 mb-5">
              開催まで あと <OpenCountdown onZero={() => setHoursOpen(false)} />
            </p>
            <p className="text-xs text-gray-400 mb-5">
              プライベート戦（あいことば）はいつでも遊べます
            </p>
            <button
              onClick={() => setHoursOpen(false)}
              className="btn w-full py-3 bg-white text-gray-700 font-semibold border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
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
            {/* 進捗フェーズ：検索中 → 相手が見つかりました → マッチング中 */}
            <p
              key={matchPhase}
              className={`text-lg font-bold mb-1 animate-rise ${
                matchPhase === 'searching'
                  ? 'text-gray-900 search-breathing'
                  : matchPhase === 'found'
                    ? 'text-emerald-600'
                    : 'text-violet-700'
              }`}
            >
              {matchPhase === 'searching'
                ? '対戦相手検索中'
                : matchPhase === 'found'
                  ? '✓ 相手が見つかりました！'
                  : 'マッチング中…'}
            </p>
            {matchMode === 'private' && matchPhase === 'searching' ? (
              <p className="text-sm text-gray-500 mb-1">
                あいことば：<span className="font-bold text-violet-700">{privateCode.trim()}</span>
              </p>
            ) : null}
            <p className="text-sm text-gray-500 mb-5">
              {matchPhase === 'found'
                ? '対戦相手とつなぎます'
                : matchPhase === 'preparing'
                  ? '対局の準備をしています'
                  : connected
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
              disabled={matchPhase !== 'searching'}
              className="btn w-full py-3 bg-white text-gray-700 font-semibold border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40"
            >
              待機をやめる
            </button>
          </div>
        </div>
      )}

      <main
        className={`min-h-screen [min-height:100dvh] flex flex-col items-center px-6 ${
          inputsOpen ? 'justify-start pt-14 pb-[60vh]' : 'justify-center py-8'
        }`}
      >
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* マスコット＋背景のリバーシ盤（タップで反応） */}
          <div className="relative animate-rise" style={{ width: 200, height: 200 }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <BoardBackdrop size={200} />
            </div>
            <button
              onClick={handlePapukoTap}
              aria-label="パプ子"
              className="absolute inset-0 flex items-center justify-center focus:outline-none"
              data-no-uisound
            >
              <span key={papukoTap?.key ?? 'idle'} className={papukoTap ? 'papuko-bounce' : ''}>
                <Papuko size={104} float glow />
              </span>
            </button>
            {papukoTap && (
              <div key={`b-${papukoTap.key}`} className="stamp-bubble" style={{ top: 6 }}>
                {papukoTap.text}
              </div>
            )}
          </div>

          {/* タイトル */}
          <p className="eyebrow text-[11px] mt-5 mb-2.5 animate-rise delay-1">Purple Games</p>
          <h1 className="wordmark text-[2.5rem] leading-none text-white text-center animate-rise delay-1">
            Purple Reversi
          </h1>
          <p className="mt-2.5 text-[15px] text-white/70 flex items-center gap-2 animate-rise delay-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="tabular-nums">{shownOnline}</span>人がオンライン
          </p>
          <p className="mt-1 text-[11px] text-white/45 animate-rise delay-2">
            （あなたを除く）
          </p>

          {/* 夜間王者（開催中=今夜の暫定王者 / 閉場後=昨晩の王者を翌20:59まで掲示） */}
          <div className="mt-1.5 mb-7 flex flex-col items-center gap-1 animate-rise delay-2">
            {champion && (
              <p className="text-[12px] font-semibold text-amber-300/95">
                👑 {onlineOpen ? '今夜の王者（暫定）' : '昨晩の王者'}: {champion.name}（{champion.wins}勝）
              </p>
            )}
            <ClosingNotice />
          </div>

          {/* アクション：2×2 グリッド */}
          <div className="w-full grid grid-cols-2 gap-3">
            {/* パプ子と対戦 */}
            <button
              onClick={() => router.push('/cpu')}
              className="btn-glass rounded-2xl flex items-center justify-center py-6 text-[15px] font-semibold leading-tight transition-transform active:scale-[0.97] animate-rise delay-2"
            >
              パプ子と対戦
            </button>

            {/* オンライン対戦（毎日21:00〜24:00限定。時間外はロック表示） */}
            <button
              onClick={() =>
                onlineOpen ? setPanel(panel === 'random' ? null : 'random') : setHoursOpen(true)
              }
              className={`rounded-2xl flex flex-col items-center justify-center py-4 text-[15px] font-semibold leading-tight transition-transform active:scale-[0.97] animate-rise delay-3 ${
                !onlineOpen
                  ? 'btn-glass opacity-55 grayscale'
                  : panel === 'random'
                    ? 'btn-violet'
                    : 'btn-glass'
              } ${justOpened ? 'open-glow' : ''}`}
            >
              <span>{onlineOpen ? 'オンライン対戦' : '🌙 オンライン対戦'}</span>
              <span
                className={`text-[10px] font-medium mt-1 ${
                  onlineOpen ? 'text-emerald-300' : 'opacity-80'
                }`}
              >
                {onlineOpen ? '🟢 開催中' : '毎日21:00〜24:00'}
              </span>
            </button>

            {/* プライベート戦（タップでトグル） */}
            <button
              onClick={() => setPanel(panel === 'private' ? null : 'private')}
              className={`rounded-2xl flex items-center justify-center gap-1.5 py-6 text-[15px] font-semibold leading-tight transition-transform active:scale-[0.97] animate-rise delay-3 ${
                panel === 'private' ? 'btn-violet' : 'btn-glass'
              }`}
            >
              <LockIcon size={15} />
              プライベート戦
            </button>

            {/* 観戦 */}
            <button
              onClick={handleOpenSpectate}
              className="btn-glass rounded-2xl flex items-center justify-center py-6 text-[15px] font-semibold leading-tight transition-transform active:scale-[0.97] animate-rise delay-4"
            >
              観戦する
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
                {loading ? '接続中…' : '対局開始'}
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
              <p className="text-sm text-white/80 leading-relaxed flex items-center justify-center gap-1.5 text-center">
                <LockIcon size={15} />
                友達と<span className="font-bold">同じあいことば</span>を入れて対戦
              </p>
              <p className="text-[11px] text-white/65 leading-relaxed text-center">
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
