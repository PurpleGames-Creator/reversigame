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
