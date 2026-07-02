import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Board from '../components/Board';
import PlayerInfo from '../components/PlayerInfo';
import Papuko from '../components/Papuko';
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  evaluateStatus,
  countPieces,
  opponent,
  WHITE,
  PURPLE,
} from '../lib/reversi';
import { chooseMove } from '../lib/ai';

const YOU = { id: 'you', name: 'あなた' };
const CPU = { id: 'papuko', name: 'パプ子' };

const DIFFICULTIES = [
  { key: 'easy', label: 'よわい', desc: 'ランダムに打つ。ルールを覚えたい人に', emoji: '🌱' },
  { key: 'normal', label: 'ふつう', desc: '角をねらってそこそこ強い', emoji: '🔥' },
  { key: 'hard', label: 'つよい', desc: '数手先まで読む。本気のパプ子', emoji: '👑' },
];

// 人間 = 白(先手), パプ子 = 紫(後手)
export default function CpuGame() {
  const router = useRouter();
  const [phase, setPhase] = useState('select'); // select | playing | finished
  const [difficulty, setDifficulty] = useState('normal');
  const [board, setBoard] = useState(createInitialBoard);
  const [turn, setTurn] = useState(WHITE);
  const [lastMove, setLastMove] = useState(null);
  const [winner, setWinner] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState(null);

  const startGame = useCallback((diff) => {
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

  // ターン進行（パス処理・CPU思考・終局判定）
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

    // 打つ手が無ければパス
    if (moves.length === 0) {
      const who = turn === WHITE ? 'あなた' : 'パプ子';
      setMessage(`${who}は打てる場所がないのでパス`);
      const t = setTimeout(() => setTurn((prev) => opponent(prev)), 1100);
      return () => clearTimeout(t);
    }

    // パプ子(紫)の手番 → 思考して着手
    if (turn === PURPLE) {
      setThinking(true);
      const t = setTimeout(() => {
        const mv = chooseMove(board, PURPLE, difficulty);
        if (mv) {
          setMessage(null);
          setBoard((b) => applyMove(b, mv.row, mv.col, PURPLE));
          setLastMove(mv);
        }
        setThinking(false);
        setTurn(WHITE);
      }, 650);
      return () => clearTimeout(t);
    }
    // あなた(白)の手番はクリック待ち
  }, [board, turn, phase, difficulty]);

  const handleCellClick = (row, col) => {
    if (phase !== 'playing' || turn !== WHITE || thinking) return;
    if (getLegalMoves(board, WHITE).indexOf(`${row},${col}`) === -1) return;
    setMessage(null);
    setBoard((b) => applyMove(b, row, col, WHITE));
    setLastMove({ row, col });
    setTurn(PURPLE);
  };

  const whiteCount = countPieces(board, WHITE);
  const purpleCount = countPieces(board, PURPLE);
  const humanMoves = phase === 'playing' && turn === WHITE && !thinking
    ? getLegalMoves(board, WHITE)
    : [];

  // ---- 難易度選択画面 ----
  if (phase === 'select') {
    return (
      <>
        <Head><title>パプ子と対戦 | Purple リバーシ</title></Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white">
          <Papuko size={130} float />
          <h1 className="text-3xl font-black mt-4 mb-1 drop-shadow">パプ子と対戦</h1>
          <p className="text-purple-200 mb-8 text-sm">難易度をえらんでね</p>

          <div className="w-full max-w-sm space-y-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                onClick={() => startGame(d.key)}
                className="w-full bg-white/95 text-gray-800 rounded-2xl px-5 py-4 text-left shadow-lg hover:bg-white transition-colors flex items-center gap-4"
              >
                <span className="text-3xl">{d.emoji}</span>
                <span>
                  <span className="block text-lg font-black text-purple-700">{d.label}</span>
                  <span className="block text-xs text-gray-500">{d.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-8 text-purple-200 underline text-sm hover:text-white"
          >
            タイトルへもどる
          </button>
        </div>
      </>
    );
  }

  // ---- 対局画面 ----
  const isFinished = phase === 'finished';
  return (
    <>
      <Head><title>パプ子と対戦 | Purple リバーシ</title></Head>
      <div className="flex flex-col h-screen">
        <PlayerInfo
          player1={{ ...YOU, pieces: whiteCount }}
          player2={{ ...CPU, pieces: purpleCount }}
          currentPlayer={turn === WHITE ? YOU.id : CPU.id}
        />

        {/* ステータス表示 */}
        <div className="text-center mt-2 h-7">
          {message ? (
            <span className="text-white font-bold text-sm bg-black/30 rounded-full px-4 py-1">{message}</span>
          ) : thinking ? (
            <span className="text-white font-bold text-sm bg-black/30 rounded-full px-4 py-1">パプ子が考え中…🤔</span>
          ) : !isFinished ? (
            <span className="text-white font-bold text-sm">
              {turn === WHITE ? 'あなたの番（白）' : 'パプ子の番（紫）'}
            </span>
          ) : null}
        </div>

        <Board
          board={board}
          legalMoves={humanMoves}
          lastMove={lastMove}
          onCellClick={handleCellClick}
        />

        <div className="p-4">
          <button
            onClick={backToSelect}
            className="w-full bg-white/90 text-purple-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-colors"
          >
            対局をやめる
          </button>
        </div>

        {/* 終局モーダル */}
        {isFinished && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
              <div className="flex justify-center mb-2">
                <Papuko size={110} />
              </div>
              <h2 className="text-2xl font-black mb-2 text-purple-700">
                {winner === 'draw' ? '引き分け！' : winner === WHITE ? 'あなたの勝ち！🎉' : 'パプ子の勝ち！'}
              </h2>
              <p className="text-gray-600 mb-4 text-sm">
                {winner === WHITE ? 'つよい！おめでとう' : winner === PURPLE ? 'また挑戦してね' : 'いい勝負だったね'}
              </p>

              <div className="flex justify-center gap-8 mb-6">
                <div>
                  <p className="text-xs text-gray-500">あなた（白）</p>
                  <p className="text-3xl font-black text-gray-800">{whiteCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">パプ子（紫）</p>
                  <p className="text-3xl font-black text-purple-600">{purpleCount}</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => startGame(difficulty)}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors"
                >
                  もう一度（{DIFFICULTIES.find((d) => d.key === difficulty)?.label}）
                </button>
                <button
                  onClick={backToSelect}
                  className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  難易度を変える
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full text-purple-600 px-4 py-2 rounded-xl font-bold hover:underline"
                >
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
