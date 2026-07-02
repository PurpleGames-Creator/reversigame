import io from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const SOCKET_URL =
      process.env.NEXT_PUBLIC_SOCKET_URL || 'https://purple-reversi.onrender.com';
    socket = io(SOCKET_URL, {
      reconnection: true,
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
