import io from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const backendUrl = 'https://purple-reversi.up.railway.app';
    console.log('[Socket] Connecting to:', backendUrl);
    socket = io(backendUrl, {
      reconnection: true,
    });
    socket.on('connect', () => {
      console.log('[Socket] Connected successfully');
    });
    socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error);
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
