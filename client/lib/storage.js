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
