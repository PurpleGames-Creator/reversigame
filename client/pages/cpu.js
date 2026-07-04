import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Board from '../components/Board';
import PlayerInfo from '../components/PlayerInfo';
import Papuko from '../components/Papuko';
import Confetti from '../components/Confetti';
import {
  createInitialBoard,
  getLegalMoves,
  getFlips,
  applyMove,
  evaluateStatus,
  countPieces,
  opponent,
  WHITE,
  PURPLE,
} from '../lib/reversi';
import SoundToggle from '../components/SoundToggle';
import CountUp from '../components/CountUp';
import Replay from '../components/Replay';
import { chooseMove } from '../lib/ai';
import { playPlace, playFlips, unlockAudio } from '../lib/sound';
import {
  isUltimateUnlocked,
  unlockUltimate,
  isUltimateBeaten,
  markUltimateBeaten,
  getCpuRecords,
  recordCpuResult,
  getCpuStreaks,
  bumpCpuStreak,
} from '../lib/storage';

const YOU = { id: 'you', name: 'あなた' };
const CPU = { id: 'papuko', name: 'パプ子' };

// 対局開始時のパプ子のあいさつ
const GREETINGS = {
  easy: 'よろしくね♪',
  normal: '油断したら知らないからね',
  hard: '本気でいくよ',
  ultimate: '……ついてこれる？',
};

const isCorner = (mv) =>
  mv && (mv.row === 0 || mv.row === 7) && (mv.col === 0 || mv.col === 7);

const DIFFICULTIES = [
  { key: 'easy', label: 'よわい', desc: '手加減してくれてもいいよ', dot: '#38bdf8' },
  { key: 'normal', label: 'ふつう', desc: '油断したら知らないからね', dot: '#fbbf24' },
  { key: 'hard', label: 'つよい', desc: '強いよ、私', dot: '#ef4444' },
  // 究極は「つよい」に勝つまでロック（解放状態は localStorage）
  { key: 'ultimate', label: '究極', desc: 'もう誰もついてこれない', dot: '#a78bfa', gated: true },
];

// 人間 = 白(先手), パプ子 = 紫(後手)
export default function CpuGame() {
  const router = useRouter();
  const [phase, setPhase] = useState('select');
  const [difficulty, setDifficulty] = useState('normal');
  const [board, setBoard] = useState(createInitialBoard);
  const [turn, setTurn] = useState(WHITE);
  const [lastMove, setLastMove] = useState(null);
  const [winner, setWinner] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState(null);
  const [ultimateUnlocked, setUltimateUnlocked] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [ultimateBeaten, setUltimateBeaten] = useState(false);
  const [justBeatUltimate, setJustBeatUltimate] = useState(false);
  const [records, setRecords] = useState({});
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintCell, setHintCell] = useState(null);
  const [papukoLine, setPapukoLine] = useState(null); // パプ子のセリフ（一時表示）
  const [streaks, setStreaks] = useState({});
  const [opening, setOpening] = useState(null); // 対局開始フラッシュ {key}
  const [replayOpen, setReplayOpen] = useState(false);

  const framesRef = useRef([]); // リプレイ用の盤面スナップショット
  const openingTimerRef = useRef(null);
  const papukoTimerRef = useRef(null);
  const leadSaidRef = useRef(false); // 「いい感じかも」を言ったか（1局1回）
  const behindSaidRef = useRef(false); // 「まだ負けてない」を言ったか（1局1回）
  const aiWorkerRef = useRef(null); // Web Worker（false=生成失敗→同期フォールバック）
  const aiReqRef = useRef(0);

  useEffect(() => {
    setUltimateUnlocked(isUltimateUnlocked());
    setUltimateBeaten(isUltimateBeaten());
    setRecords(getCpuRecords());
    setStreaks(getCpuStreaks());
  }, []);

  // アンマウント時にAIワーカーを破棄
  useEffect(
    () => () => {
      if (aiWorkerRef.current) aiWorkerRef.current.terminate();
    },
    []
  );

  // パプ子のセリフを2.6秒だけ表示
  const say = useCallback((text) => {
    if (papukoTimerRef.current) clearTimeout(papukoTimerRef.current);
    setPapukoLine(text);
    papukoTimerRef.current = setTimeout(() => setPapukoLine(null), 2600);
  }, []);

  // AIの思考。Web Worker で計算してUIを固めない（使えない環境は同期にフォールバック）
  const computeMove = useCallback((b, color, diff) => {
    return new Promise((resolve) => {
      if (aiWorkerRef.current === null) {
        try {
          aiWorkerRef.current = new Worker(new URL('../lib/ai.worker.js', import.meta.url));
        } catch (e) {
          aiWorkerRef.current = false;
        }
      }
      const w = aiWorkerRef.current;
      if (!w) {
        resolve(chooseMove(b, color, diff));
        return;
      }
      const id = ++aiReqRef.current;
      const fallback = () => {
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
        clearTimeout(guard);
        resolve(chooseMove(b, color, diff));
      };
      const onMsg = (e) => {
        if (!e.data || e.data.id !== id) return;
        if (e.data.error) {
          fallback();
          return;
        }
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
        clearTimeout(guard);
        resolve(e.data.mv);
      };
      const onErr = () => {
        aiWorkerRef.current = false; // 以後は同期で
        fallback();
      };
      const guard = setTimeout(onErr, 8000);
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ id, board: b, color, difficulty: diff });
    });
  }, []);

  const startGame = useCallback(
    (diff) => {
      unlockAudio();
      setJustUnlocked(false);
      setJustBeatUltimate(false);
      setDifficulty(diff);
      const initial = createInitialBoard();
      setBoard(initial);
      framesRef.current = [{ board: initial, lastMove: null }];
      setReplayOpen(false);
      setTurn(WHITE);
      setLastMove(null);
      setWinner(null);
      setThinking(false);
      setMessage(null);
      setHintsLeft(3);
      setHintCell(null);
      leadSaidRef.current = false;
      behindSaidRef.current = false;
      setPhase('playing');
      // 対局開始フラッシュ（1.4秒で自動消滅）
      setOpening({ key: Date.now() });
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
      openingTimerRef.current = setTimeout(() => setOpening(null), 1450);
      say(GREETINGS[diff] || 'よろしくね♪');
    },
    [say]
  );

  const backToSelect = useCallback(() => {
    setPhase('select');
    setMessage(null);
    setPapukoLine(null);
  }, []);

  // ヒント：つよいAIの手を1つ光らせる（よわい/ふつう限定・1局3回）
  const handleHint = useCallback(() => {
    if (hintsLeft <= 0) return;
    const mv = chooseMove(board, WHITE, 'hard');
    if (mv) {
      setHintCell(mv);
      setHintsLeft((n) => n - 1);
    }
  }, [board, hintsLeft]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const status = evaluateStatus(board);
    if (status.finished) {
      setWinner(status.winner);
      setThinking(false);
      setPhase('finished');
      // 難易度別の戦績・連勝を記録
      recordCpuResult(
        difficulty,
        status.winner === WHITE ? 'w' : status.winner === PURPLE ? 'l' : 'd'
      );
      bumpCpuStreak(difficulty, status.winner === WHITE);
      setRecords(getCpuRecords());
      setStreaks(getCpuStreaks());
      // 「つよい」に勝ったら究極を解放
      if (status.winner === WHITE && difficulty === 'hard' && !ultimateUnlocked) {
        unlockUltimate();
        setUltimateUnlocked(true);
        setJustUnlocked(true);
      }
      // 「究極」に勝ったら称号を獲得
      if (status.winner === WHITE && difficulty === 'ultimate' && !ultimateBeaten) {
        markUltimateBeaten();
        setUltimateBeaten(true);
        setJustBeatUltimate(true);
      }
      return;
    }

    const moves = getLegalMoves(board, turn);
    if (moves.length === 0) {
      const who = turn === WHITE ? 'あなた' : 'パプ子';
      setMessage(`${who}は打てる場所がないのでパス`);
      const t = setTimeout(() => setTurn((prev) => opponent(prev)), 1100);
      return () => clearTimeout(t);
    }

    if (turn === PURPLE) {
      setThinking(true);
      let cancelled = false;
      const t = setTimeout(() => {
        computeMove(board, PURPLE, difficulty).then((mv) => {
          if (cancelled) return;
          if (mv) {
            setMessage(null);
            const flipped = getFlips(board, mv.row, mv.col, PURPLE).length;
            const next = applyMove(board, mv.row, mv.col, PURPLE);
            setBoard(next);
            framesRef.current.push({ board: next, lastMove: mv });
            setLastMove(mv);
            playPlace();
            playFlips(flipped);

            // 状況に応じたパプ子のセリフ
            if (isCorner(mv)) {
              say('角、もーらい♪');
            } else {
              const w = countPieces(next, WHITE);
              const p = countPieces(next, PURPLE);
              if (w + p >= 20) {
                if (p - w >= 8 && !leadSaidRef.current) {
                  leadSaidRef.current = true;
                  say('ふふ、いい感じかも');
                } else if (w - p >= 8 && !behindSaidRef.current) {
                  behindSaidRef.current = true;
                  say('まだ負けてないから…！');
                }
              }
            }
          }
          setThinking(false);
          setTurn(WHITE);
        });
      }, 650);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [board, turn, phase, difficulty, ultimateUnlocked, ultimateBeaten, computeMove, say]);

  const handleCellClick = (row, col) => {
    if (phase !== 'playing' || turn !== WHITE || thinking) return;
    if (getLegalMoves(board, WHITE).indexOf(`${row},${col}`) === -1) return;
    setMessage(null);
    setHintCell(null);
    const flipped = getFlips(board, row, col, WHITE).length;
    const next = applyMove(board, row, col, WHITE);
    setBoard(next);
    framesRef.current.push({ board: next, lastMove: { row, col } });
    setLastMove({ row, col });
    playPlace();
    playFlips(flipped);
    if (isCorner({ row, col })) say('あーっ！角とられた！');
    setTurn(PURPLE);
  };

  const whiteCount = countPieces(board, WHITE);
  const purpleCount = countPieces(board, PURPLE);
  const humanMoves =
    phase === 'playing' && turn === WHITE && !thinking ? getLegalMoves(board, WHITE) : [];


  // ---- 難易度選択 ----
  if (phase === 'select') {
    return (
      <>
        <Head><title>パプ子と対戦 | Purple Reversi</title></Head>
        <SoundToggle />
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="animate-rise">
              <Papuko size={128} float glow />
            </div>
            <h1 className="wordmark text-3xl text-white mt-6 animate-rise delay-1">
              パプ子と対戦
            </h1>
            <p className="text-white/70 mt-2 mb-8 text-sm animate-rise delay-1">
              難易度をえらんでください
            </p>

            <div className="w-full space-y-3">
              {DIFFICULTIES.map((d, i) => {
                const locked = d.gated && !ultimateUnlocked;
                const rec = records[d.key];
                const hasRec = !locked && rec && rec.w + rec.l + (rec.d || 0) > 0;
                return (
                  <button
                    key={d.key}
                    onClick={() => !locked && startGame(d.key)}
                    disabled={locked}
                    className={`glass-light w-full rounded-2xl px-5 py-4 text-left flex items-center gap-3.5 animate-rise delay-${Math.min(i + 2, 4)} ${
                      locked
                        ? 'opacity-50 grayscale cursor-not-allowed'
                        : 'transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]'
                    }`}
                  >
                    <span
                      className="inline-block rounded-full shrink-0"
                      style={{
                        width: 12,
                        height: 12,
                        background: locked ? '#9ca3af' : d.dot,
                        boxShadow: locked ? 'none' : `0 0 10px ${d.dot}`,
                      }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] font-bold text-gray-900 leading-tight">
                        {d.label}
                        {d.key === 'ultimate' && ultimateBeaten && (
                          <span className="ml-1.5" title="究極を超えた者">👑</span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {locked ? '？？？' : d.desc}
                      </span>
                    </span>
                    {hasRec && (
                      <span className="text-right shrink-0">
                        <span className="block text-[11px] text-gray-400 tabular-nums">
                          {rec.w}勝{rec.l}敗{(rec.d || 0) > 0 ? `${rec.d}分` : ''}
                        </span>
                        {(streaks[d.key] || 0) >= 2 && (
                          <span className="block text-[11px] font-bold text-orange-500 tabular-nums">
                            🔥{streaks[d.key]}連勝中
                          </span>
                        )}
                      </span>
                    )}
                    {locked && (
                      <span className="text-lg shrink-0" aria-label="ロック中">
                        🔒
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => router.push('/')}
              className="btn btn-ghost mt-8 text-sm animate-rise delay-4"
            >
              タイトルへもどる
            </button>
          </div>
        </main>
      </>
    );
  }

  // ---- 対局 ----
  const isFinished = phase === 'finished';
  return (
    <>
      <Head><title>パプ子と対戦 | Purple Reversi</title></Head>
      <SoundToggle />
      <div className="flex flex-col h-screen [height:100dvh] lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-10">
        {/* 情報パネル（モバイル: 上部 / lg以上: 左サイド） */}
        <div className="flex flex-col shrink-0 lg:w-[22rem]">
          <PlayerInfo
            player1={{ ...YOU, pieces: whiteCount }}
            player2={{ ...CPU, pieces: purpleCount }}
            currentPlayer={turn === WHITE ? YOU.id : CPU.id}
          />

          <div className="relative text-center mt-3 h-8 flex items-center justify-center">
            {/* ヒント：ステータス行の右端に常駐（行が増減しないので盤面が動かない） */}
            {(difficulty === 'easy' || difficulty === 'normal') && !isFinished && (
              <button
                onClick={handleHint}
                disabled={!(phase === 'playing' && turn === WHITE && !thinking && hintsLeft > 0)}
                title={hintsLeft > 0 ? `ヒント（あと${hintsLeft}回）` : 'ヒントを使い切った'}
                className="absolute right-4 top-1/2 -translate-y-1/2 btn btn-glass px-3 py-1 text-xs disabled:opacity-35 tabular-nums"
              >
                💡×{hintsLeft}
              </button>
            )}
            {message ? (
              <span className="text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                {message}
              </span>
            ) : papukoLine ? (
              <span className="text-sm font-medium text-violet-100 bg-violet-600/60 rounded-full px-4 py-1.5">
                💬 {papukoLine}
              </span>
            ) : thinking ? (
              <span className="text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                {difficulty === 'ultimate' ? 'パプ子が本気で考え中…' : 'パプ子が考え中…'}
              </span>
            ) : !isFinished ? (
              <span
                className={`text-sm font-semibold rounded-full px-4 py-1.5 ${
                  turn === WHITE ? 'bg-white text-violet-800' : 'text-white/75'
                }`}
              >
                {turn === WHITE ? 'あなたの番' : 'パプ子の番'}
              </span>
            ) : null}
          </div>


          <div className="hidden lg:block px-4 mt-8">
            <button onClick={backToSelect} className="btn btn-glass w-full py-3.5">
              対局をやめる
            </button>
          </div>
        </div>

        <Board
          board={board}
          legalMoves={humanMoves}
          lastMove={lastMove}
          onCellClick={handleCellClick}
          finished={isFinished}
          hintCell={hintCell}
        />

        <div className="lg:hidden px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <button onClick={backToSelect} className="btn btn-glass w-full py-3.5">
            対局をやめる
          </button>
        </div>


        {/* 対局開始フラッシュ */}
        {opening && (
          <div key={opening.key} className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="open-flash glass-light rounded-2xl px-8 py-4 text-center">
              <p className="wordmark text-xl text-gray-900">対局開始</p>
              <p className="text-sm text-gray-500 mt-0.5">あなたは白（先手）</p>
            </div>
          </div>
        )}

        {isFinished && winner === WHITE && (
          <Confetti
            colors={difficulty === 'ultimate' ? ['#fbbf24', '#fff8e1'] : undefined}
            count={purpleCount === 0 ? 40 : 20}
          />
        )}

        {/* リプレイ */}
        {replayOpen && (
          <Replay frames={framesRef.current} onClose={() => setReplayOpen(false)} />
        )}

        {isFinished && (
          <div className="finish-overlay fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="finish-card glass-light rounded-3xl p-7 max-w-sm w-full text-center">
              <div className="flex justify-center -mt-16 mb-1">
                <Papuko size={116} glow />
              </div>
              <h2 className={`wordmark text-2xl text-gray-900 ${winner === 'draw' ? 'mb-1' : 'mb-5'}`}>
                {winner === 'draw' ? '引き分け' : winner === WHITE ? 'あなたの勝ち' : 'パプ子の勝ち'}
              </h2>
              {winner === 'draw' && (
                <p className="text-gray-500 text-sm mb-5">いい勝負でした</p>
              )}

              {justUnlocked && (
                <div className="mb-5 rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700">
                  🔓 隠された難易度「究極」が解放された！
                </div>
              )}

              {justBeatUltimate && (
                <div className="mb-5 rounded-xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-sm font-bold text-amber-700">
                  👑 称号「究極を超えた者」を獲得！
                </div>
              )}

              {winner === WHITE && purpleCount === 0 && (
                <div className="mb-5 rounded-xl bg-sky-50 border border-sky-300 px-4 py-2.5 text-sm font-bold text-sky-700">
                  💎 パーフェクト！ 相手の石を全滅させた！
                </div>
              )}

              <div className="flex justify-center gap-10 mb-6">
                <div>
                  <p className="text-xs text-gray-400">あなた（白）</p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    <CountUp value={whiteCount} />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">パプ子（紫）</p>
                  <p className="text-3xl font-bold text-violet-600 tabular-nums">
                    <CountUp value={purpleCount} />
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button onClick={() => startGame(difficulty)} className="btn btn-violet w-full py-3.5">
                  もう一度（{DIFFICULTIES.find((d) => d.key === difficulty)?.label}）
                </button>
                <button
                  onClick={backToSelect}
                  className="btn w-full py-3 bg-gray-900 text-white hover:bg-gray-950"
                >
                  難易度を変える
                </button>
                <button
                  onClick={() => setReplayOpen(true)}
                  className="btn w-full py-2 text-gray-500 hover:opacity-70"
                >
                  📼 リプレイを見る
                </button>
                <button onClick={() => router.push('/')} className="btn w-full py-2 text-violet-600 hover:opacity-70">
                  タイトルへ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
