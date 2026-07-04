export const getPlayerName = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('playerName');
};

export const setPlayerName = (name) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('playerName', name);
};

export const clearPlayerName = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem('playerName');
};

// CPU戦「究極」の解放状態（「つよい」に勝つと解放。端末ごとに保存）
export const isUltimateUnlocked = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return localStorage.getItem('ultimateUnlocked') === '1';
};

export const unlockUltimate = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('ultimateUnlocked', '1');
};

// 「究極」撃破の称号（究極に勝つと獲得。端末ごとに保存）
export const isUltimateBeaten = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return localStorage.getItem('ultimateBeaten') === '1';
};

export const markUltimateBeaten = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('ultimateBeaten', '1');
};

// 盤面テーマ（green | purple | wood）。既定はクラシック緑
export const getBoardTheme = () => {
  if (typeof window === 'undefined') {
    return 'green';
  }
  const t = localStorage.getItem('boardTheme');
  return t === 'purple' || t === 'wood' ? t : 'green';
};

export const setBoardTheme = (theme) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem('boardTheme', theme);
  } catch (e) {
    /* ignore */
  }
};

// CPU戦の難易度別戦績 { easy: {w,l,d}, normal: {...}, ... }
export const getCpuRecords = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    return JSON.parse(localStorage.getItem('cpuRecords') || '{}');
  } catch (e) {
    return {};
  }
};

// CPU戦の現在の連勝数 { easy: n, ... }（勝ちで+1、負け/引き分けで0にリセット）
export const getCpuStreaks = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    return JSON.parse(localStorage.getItem('cpuStreaks') || '{}');
  } catch (e) {
    return {};
  }
};

export const bumpCpuStreak = (difficulty, won) => {
  if (typeof window === 'undefined') {
    return 0;
  }
  const streaks = getCpuStreaks();
  streaks[difficulty] = won ? (streaks[difficulty] || 0) + 1 : 0;
  try {
    localStorage.setItem('cpuStreaks', JSON.stringify(streaks));
  } catch (e) {
    /* ignore */
  }
  return streaks[difficulty];
};

export const recordCpuResult = (difficulty, result) => {
  // result: 'w'(勝ち) | 'l'(負け) | 'd'(引き分け)
  if (typeof window === 'undefined') {
    return;
  }
  const records = getCpuRecords();
  const rec = records[difficulty] || { w: 0, l: 0, d: 0 };
  rec[result] = (rec[result] || 0) + 1;
  records[difficulty] = rec;
  try {
    localStorage.setItem('cpuRecords', JSON.stringify(records));
  } catch (e) {
    /* 保存できない環境では諦める */
  }
};
