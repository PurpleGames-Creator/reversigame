/**
 * CPU戦の対局数記録（Supabase reversi_matches へ 1 行 insert）
 *
 * - 目的は週次レポートの件数カウントのみ。勝敗・盤面・個人情報は送らない
 *   （detail に難易度だけ入れる）
 * - anon key はブラウザ埋め込み前提の公開キー（他の PurpleGames と同じ扱い）
 * - fire-and-forget: 失敗してもゲームには一切影響させない
 * - localhost では記録しない（開発中の対局でカウントが汚れるのを防ぐ）
 */
const SUPABASE_URL = 'https://hefayilffszrczxhnpii.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZmF5aWxmZnN6cmN6eGhucGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDI5NDEsImV4cCI6MjA4NzUxODk0MX0.qUsuQOIZzdlFLXtR-i1d9TX5c3P9QKPdhv34QGt4V_k';

export function logCpuMatch(difficulty) {
  try {
    if (typeof window === 'undefined') return;
    if (/^(localhost|127\.)/.test(window.location.hostname)) return;
    fetch(`${SUPABASE_URL}/rest/v1/reversi_matches`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ mode: 'cpu', detail: difficulty || null }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {
    /* 記録失敗は無視（ゲームを止めない） */
  }
}
