import io from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const backendUrl = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL
      ? process.env.NEXT_PUBLIC_BACKEND_URL
      : 'https://purple-reversi.up.railway.app';
    socket = io(backendUrl, {
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
