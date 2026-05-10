const RoomManager = require('../managers/RoomManager');
const { getLegalMoves } = require('../game/rules');

/**
 * Socket.io Event Handlers Registration
 *
 * Registers all Socket.io event handlers for real-time game communication
 * Manages player connections, room creation/joining, and game state synchronization
 *
 * @param {Server} io - Socket.io server instance
 */
function registerSocketHandlers(io) {
  // Singleton RoomManager instance for this server
  const roomManager = new RoomManager();

  // Map to store player names by socket ID
  const playerNames = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    /**
     * EVENT: 'register' - Player registration
     *
     * Register a player with their name and get assigned to this socket
     */
    socket.on('register', (playerName, callback) => {
      try {
        // Store player name
        playerNames.set(socket.id, playerName);

        console.log(`Player registered: ${socket.id} - ${playerName}`);

        // Callback success
        if (callback) {
          callback({ success: true });
        }

        // Emit online count update to all clients
        const onlineCount = playerNames.size;
        io.emit('online-count-updated', { onlineCount });
      } catch (error) {
        console.error('Error in register event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'get-rooms' - Get room lists
     *
     * Retrieve all waiting and playing rooms for the client to display
     */
    socket.on('get-rooms', (callback) => {
      try {
        const waitingRooms = roomManager.getWaitingRooms().map(room => ({
          roomId: room.roomId,
          hostName: room.host.name
        }));

        const playingRooms = roomManager.getPlayingRooms().map(room => ({
          player1: room.host.name,
          player2: room.guest ? room.guest.name : 'Waiting...'
        }));

        const onlineCount = playerNames.size;

        if (callback) {
          callback({
            waiting: waitingRooms,
            playing: playingRooms,
            onlineCount
          });
        }
      } catch (error) {
        console.error('Error in get-rooms event:', error);
        if (callback) {
          callback({ error: error.message });
        }
      }
    });

    /**
     * EVENT: 'create-room' - Create new room
     *
     * Create a new game room with this player as host
     */
    socket.on('create-room', (callback) => {
      try {
        const playerName = playerNames.get(socket.id);

        if (!playerName) {
          throw new Error('Player not registered');
        }

        // Create room via RoomManager
        const roomId = roomManager.createRoom(socket.id, playerName);

        // Join the socket to the room
        socket.join(roomId);

        console.log(`Room created: ${roomId} by ${playerName}`);

        // Emit rooms-updated to all clients
        emitRoomsUpdated(io, roomManager);

        // Callback with room ID
        if (callback) {
          callback({ roomId, success: true });
        }
      } catch (error) {
        console.error('Error in create-room event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'join-room' - Join existing room
     *
     * Join an existing waiting room to start a game
     */
    socket.on('join-room', (roomId, callback) => {
      try {
        const playerName = playerNames.get(socket.id);

        if (!playerName) {
          throw new Error('Player not registered');
        }

        // Join room via RoomManager
        const room = roomManager.joinRoom(roomId, socket.id, playerName);

        // Join socket to room
        socket.join(roomId);

        console.log(`Player ${playerName} joined room: ${roomId}`);

        // Emit game-started event to room with game state
        const gameState = room.game.serialize();
        io.to(roomId).emit('game-started', gameState);

        // Get and emit legal moves for current player
        const legalMoves = getLegalMoves(room.game);
        io.to(roomId).emit('legal-moves-updated', { legalMoves });

        // ゲーム開始時にターンを開始
        room.game.startTurn();

        // Emit rooms-updated to all clients
        emitRoomsUpdated(io, roomManager);

        // Callback success with game state
        if (callback) {
          callback({ success: true, gameState });
        }
      } catch (error) {
        console.error('Error in join-room event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'place-piece' - Place piece on board
     *
     * Place a piece at specified coordinates and execute move
     */
    socket.on('place-piece', (roomId, row, col, callback) => {
      try {
        // Verify room exists and player is in it
        const room = roomManager.getPlayerRoom(socket.id);

        if (!room || room.roomId !== roomId) {
          throw new Error('Invalid room or player not in room');
        }

        if (room.status !== 'playing') {
          throw new Error('Game is not in progress');
        }

        // Make the move
        const gameState = roomManager.makeMove(roomId, row, col);

        console.log(`Move made in room ${roomId} at [${row}, ${col}]`);

        // Clear timeout for current player and start new timeout for next player
        room.game.clearTurnTimeout();

        // Emit board-updated to room
        io.to(roomId).emit('board-updated', gameState);

        // Get legal moves for next player and emit
        const legalMoves = getLegalMoves(room.game);
        io.to(roomId).emit('legal-moves-updated', { legalMoves });

        // Start turn for next player
        if (!room.game.isFinished) {
          room.game.startTurn();
        }

        // Check if game is finished
        if (room.game.isFinished) {
          io.to(roomId).emit('game-finished', gameState);
          room.status = 'finished';
        }

        // Callback success
        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        console.error('Error in place-piece event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'resign' - Player resignation
     *
     * Player resigns from the game, ending it immediately
     */
    socket.on('resign', (roomId, callback) => {
      try {
        // Verify room exists and player is in it
        const room = roomManager.getPlayerRoom(socket.id);

        if (!room || room.roomId !== roomId) {
          throw new Error('Invalid room or player not in room');
        }

        // Finish the game
        const gameState = roomManager.finishGame(roomId);

        console.log(`Player ${socket.id} resigned from room ${roomId}`);

        // Emit game-finished to room
        io.to(roomId).emit('game-finished', gameState);

        // Callback success
        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        console.error('Error in resign event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'leave-room' - Leave room
     *
     * Player leaves the room (for waiting rooms or after game ends)
     */
    socket.on('leave-room', (roomId, callback) => {
      try {
        // Leave socket room
        socket.leave(roomId);

        // Leave game room in RoomManager
        roomManager.leaveRoom(roomId);

        console.log(`Player ${socket.id} left room ${roomId}`);

        // Emit rooms-updated to all clients
        emitRoomsUpdated(io, roomManager);

        // Callback success
        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        console.error('Error in leave-room event:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * EVENT: 'disconnect' - Player disconnect
     *
     * Handle player disconnection - clean up room and notify others
     */
    socket.on('disconnect', () => {
      try {
        console.log(`User disconnected: ${socket.id}`);

        // Check if player was in a game
        const room = roomManager.getPlayerRoom(socket.id);

        if (room && room.status === 'playing') {
          // Notify opponent of disconnection
          io.to(room.roomId).emit('opponent-disconnected');

          // Clean up room
          roomManager.leaveRoom(room.roomId);
        } else if (room) {
          // Clean up waiting room
          roomManager.leaveRoom(room.roomId);
        }

        // Remove player name
        playerNames.delete(socket.id);

        // Emit online count update
        const onlineCount = playerNames.size;
        io.emit('online-count-updated', { onlineCount });

        // Emit rooms-updated to all clients
        emitRoomsUpdated(io, roomManager);
      } catch (error) {
        console.error('Error in disconnect event:', error);
      }
    });
  });
}

/**
 * Helper function to emit updated room lists to all clients
 * @param {Server} io - Socket.io server instance
 * @param {RoomManager} roomManager - Room manager instance
 */
function emitRoomsUpdated(io, roomManager) {
  const waitingRooms = roomManager.getWaitingRooms().map(room => ({
    roomId: room.roomId,
    hostName: room.host.name
  }));

  const playingRooms = roomManager.getPlayingRooms().map(room => ({
    player1: room.host.name,
    player2: room.guest ? room.guest.name : 'Waiting...'
  }));

  io.emit('rooms-updated', {
    waiting: waitingRooms,
    playing: playingRooms
  });
}

module.exports = registerSocketHandlers;
