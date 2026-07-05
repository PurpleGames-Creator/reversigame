/**
 * 対局数の記録（Supabase reversi_matches へ 1 行 insert）
 *
 * - 目的は週次レポートの件数カウントのみ。個人情報・盤面は送らない
 * - anon key はブラウザ埋め込み前提の公開キー（他の PurpleGames と同じ扱い）
 * - fire-and-forget: 失敗してもゲーム進行には一切影響させない
 * - Render 上でのみ記録する（RENDER 環境変数は Render が自動設定。
 *   ローカル開発・E2E の対局でカウントが汚れるのを防ぐ）
 */
const SUPABASE_URL = 'https://hefayilffszrczxhnpii.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZmF5aWxmZnN6cmN6eGhucGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDI5NDEsImV4cCI6MjA4NzUxODk0MX0.qUsuQOIZzdlFLXtR-i1d9TX5c3P9QKPdhv34QGt4V_k';

function logMatch(mode, detail) {
  try {
    if (!process.env.RENDER) return;
    fetch(`${SUPABASE_URL}/rest/v1/reversi_matches`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ mode, detail: detail || null }),
    }).catch(() => {});
  } catch (_) {
    /* 記録失敗は無視（ゲームを止めない） */
  }
}

module.exports = { logMatch };
