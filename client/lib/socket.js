import io from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    socket = io('https://purple-reversi.up.railway.app', {
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
