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
