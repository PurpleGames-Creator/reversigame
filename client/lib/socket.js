import io from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
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
