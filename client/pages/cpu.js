import { useState, useEffect, useCallback } from 'react';
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
import { chooseMove } from '../lib/ai';
import { playPlace, playFlips, unlockAudio } from '../lib/sound';

const YOU = { id: 'you', name: 'あなた' };
const CPU = { id: 'papuko', name: 'パプ子' };

const DIFFICULTIES = [
  { key: 'easy', label: 'よわい', desc: '位置を考えて打つ。腕試しの入門に', dot: '#34d399' },
  { key: 'normal', label: 'ふつう', desc: '数手先を読んでくる', dot: '#a78bfa' },
  { key: 'hard', label: 'つよい', desc: 'さらに深く読む本気のパプ子', dot: '#fbbf24' },
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

  const startGame = useCallback((diff) => {
    unlockAudio();
    setDifficulty(diff);
    setBoard(createInitialBoard());
    setTurn(WHITE);
    setLastMove(null);
    setWinner(null);
    setThinking(false);
    setMessage(null);
    setPhase('playing');
  }, []);

  const backToSelect = useCallback(() => {
    setPhase('select');
    setMessage(null);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;

    const status = evaluateStatus(board);
    if (status.finished) {
      setWinner(status.winner);
      setThinking(false);
      setPhase('finished');
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
      const t = setTimeout(() => {
        const mv = chooseMove(board, PURPLE, difficulty);
        if (mv) {
          setMessage(null);
          const flipped = getFlips(board, mv.row, mv.col, PURPLE).length;
          setBoard((b) => applyMove(b, mv.row, mv.col, PURPLE));
          setLastMove(mv);
          playPlace();
          playFlips(flipped);
        }
        setThinking(false);
        setTurn(WHITE);
      }, 650);
      return () => clearTimeout(t);
    }
  }, [board, turn, phase, difficulty]);

  const handleCellClick = (row, col) => {
    if (phase !== 'playing' || turn !== WHITE || thinking) return;
    if (getLegalMoves(board, WHITE).indexOf(`${row},${col}`) === -1) return;
    setMessage(null);
    const flipped = getFlips(board, row, col, WHITE).length;
    setBoard((b) => applyMove(b, row, col, WHITE));
    setLastMove({ row, col });
    playPlace();
    playFlips(flipped);
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
              {DIFFICULTIES.map((d, i) => (
                <button
                  key={d.key}
                  onClick={() => startGame(d.key)}
                  className={`glass-light w-full rounded-2xl px-5 py-4 text-left flex items-center gap-3.5 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] animate-rise delay-${i + 2}`}
                >
                  <span
                    className="inline-block rounded-full shrink-0"
                    style={{ width: 12, height: 12, background: d.dot, boxShadow: `0 0 10px ${d.dot}` }}
                  />
                  <span>
                    <span className="block text-[17px] font-bold text-gray-900 leading-tight">
                      {d.label}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">{d.desc}</span>
                  </span>
                </button>
              ))}
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
      <div className="flex flex-col h-screen [height:100dvh] lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-10">
        {/* 情報パネル（モバイル: 上部 / lg以上: 左サイド） */}
        <div className="flex flex-col shrink-0 lg:w-[22rem]">
          <PlayerInfo
            player1={{ ...YOU, pieces: whiteCount }}
            player2={{ ...CPU, pieces: purpleCount }}
            currentPlayer={turn === WHITE ? YOU.id : CPU.id}
          />

          <div className="text-center mt-3 h-8 flex items-center justify-center">
            {message ? (
              <span className="text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                {message}
              </span>
            ) : thinking ? (
              <span className="text-sm font-medium text-white/90 glass rounded-full px-4 py-1.5">
                パプ子が考え中…
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
        />

        <div className="lg:hidden px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <button onClick={backToSelect} className="btn btn-glass w-full py-3.5">
            対局をやめる
          </button>
        </div>


        {isFinished && winner === WHITE && <Confetti />}

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

              <div className="flex justify-center gap-10 mb-6">
                <div>
                  <p className="text-xs text-gray-400">あなた（白）</p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">{whiteCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">パプ子（紫）</p>
                  <p className="text-3xl font-bold text-violet-600 tabular-nums">{purpleCount}</p>
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
