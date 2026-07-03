import io from 'socket.io-client';

let socket = null;

// タブごとの永続プレイヤートークン。socket.io の auth で常時送られるため、
// 再接続で socket.id が変わってもサーバー側で本人を特定できる（rejoin-room 用）。
// sessionStorage なのでタブが違えば別プレイヤー扱いになり衝突しない。
const getPlayerToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    let token = sessionStorage.getItem('pr_player_token');
    if (!token) {
      token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('pr_player_token', token);
    }
    return token;
  } catch (e) {
    return null;
  }
};

export const initSocket = () => {
  if (!socket) {
    const SOCKET_URL =
      process.env.NEXT_PUBLIC_SOCKET_URL || 'https://purple-reversi.onrender.com';
    socket = io(SOCKET_URL, {
      reconnection: true,
      auth: { token: getPlayerToken() },
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
