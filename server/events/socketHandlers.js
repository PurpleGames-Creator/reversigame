const RoomManager = require('../managers/RoomManager');
const { getLegalMoves } = require('../game/rules');

/**
 * Socket.io イベントハンドラ登録
 *
 * クライアント(client/pages/*)が期待する形へ揃えた状態を返すのがポイント:
 * - 盤面値: 1=白(host/先手), 2=紫(guest)
 * - player1=白(host), player2=紫(guest)。currentPlayer/winner はプレイヤーID(socket.id)
 * - legalMoves は "row,col" 文字列配列（Boardコンポーネント互換）
 * - gameState は 'waiting' | 'playing' | 'finished'
 */
function registerSocketHandlers(io) {
  const roomManager = new RoomManager();
  const playerNames = new Map(); // socket.id -> name

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // ---- ヘルパ ----------------------------------------------------------

    // クライアントが期待する形の状態オブジェクトを組み立てる
    const buildClientState = (room) => {
      // まだ対局前（募集中）
      if (!room.game) {
        return {
          gameState: room.status, // 'waiting'
          waiting: true,
          player1: { id: room.host.id, name: room.host.name, pieces: 2 },
          player2: room.guest
            ? { id: room.guest.id, name: room.guest.name, pieces: 2 }
            : null,
          currentPlayer: null,
          board: null,
          lastMove: null,
          winner: null,
        };
      }

      const s = room.game.serialize();
      const currentPlayer = s.currentPlayer === 'black' ? room.host.id : room.guest.id;

      let winner = null;
      if (s.isFinished) {
        if (room.resignWinnerId) winner = room.resignWinnerId;
        else if (s.winner === 'black') winner = room.host.id;
        else if (s.winner === 'white') winner = room.guest.id;
        else winner = 'draw';
      }

      return {
        board: s.board,
        currentPlayer,
        gameState: s.isFinished ? 'finished' : 'playing',
        player1: { id: room.host.id, name: room.host.name, pieces: s.blackCount },
        player2: { id: room.guest.id, name: room.guest.name, pieces: s.whiteCount },
        lastMove: room.lastMove || null,
        winner,
      };
    };

    // "row,col" 文字列配列で合法手を返す
    const legalMovesStr = (game) =>
      getLegalMoves(game).map(([r, c]) => `${r},${c}`);

    // payload が {roomId} でも文字列でも roomId を取り出す
    const getRoomId = (payload) =>
      payload && typeof payload === 'object' ? payload.roomId : payload;

    // ---- register --------------------------------------------------------
    socket.on('register', (playerName, callback) => {
      try {
        playerNames.set(socket.id, playerName);
        console.log(`Player registered: ${socket.id} - ${playerName}`);
        if (callback) callback({ success: true });
        io.emit('online-count-updated', { onlineCount: playerNames.size });
      } catch (error) {
        console.error('register error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- get-rooms -------------------------------------------------------
    socket.on('get-rooms', (callback) => {
      try {
        if (callback) callback(buildRoomsPayload(roomManager, playerNames));
      } catch (error) {
        console.error('get-rooms error:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // ---- create-room -----------------------------------------------------
    socket.on('create-room', (callback) => {
      try {
        const playerName = playerNames.get(socket.id);
        if (!playerName) throw new Error('Player not registered');

        const roomId = roomManager.createRoom(socket.id, playerName);
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${playerName}`);

        emitRoomsUpdated(io, roomManager, playerNames);
        if (callback) callback({ roomId, success: true });
      } catch (error) {
        console.error('create-room error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- join-room -------------------------------------------------------
    socket.on('join-room', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const playerName = playerNames.get(socket.id);
        if (!playerName) throw new Error('Player not registered');

        const room = roomManager.joinRoom(roomId, socket.id, playerName);
        socket.join(roomId);
        room.lastMove = null;
        console.log(`Player ${playerName} joined room: ${roomId}`);

        // 対局開始を部屋の全員へ
        const state = buildClientState(room);
        io.to(roomId).emit('game-started', state);
        io.to(roomId).emit('legal-moves-updated', { legalMoves: legalMovesStr(room.game) });

        room.game.startTurn();
        emitRoomsUpdated(io, roomManager, playerNames);

        if (callback) callback({ success: true, roomId, gameState: state });
      } catch (error) {
        console.error('join-room error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- get-game-state --------------------------------------------------
    socket.on('get-game-state', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room || room.roomId !== roomId) {
          if (callback) callback({});
          return;
        }
        const state = buildClientState(room);
        const legalMoves = room.game ? legalMovesStr(room.game) : [];
        if (callback) callback({ ...state, legalMoves });
      } catch (error) {
        console.error('get-game-state error:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // ---- place-piece -----------------------------------------------------
    socket.on('place-piece', (payload, callback) => {
      try {
        const { roomId, row, col } = payload || {};
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room || room.roomId !== roomId) throw new Error('Invalid room');
        if (room.status !== 'playing' || !room.game) throw new Error('Game is not in progress');

        // 手番チェック（自分の番以外は弾く）
        const myColor = room.host.id === socket.id ? 'black' : 'white';
        if (room.game.currentPlayer !== myColor) throw new Error('あなたの番ではありません');

        room.game.clearTurnTimeout();
        roomManager.makeMove(roomId, row, col);
        room.lastMove = { row, col };
        console.log(`Move in ${roomId} at [${row}, ${col}]`);

        const state = buildClientState(room);
        io.to(roomId).emit('board-updated', state);
        io.to(roomId).emit('legal-moves-updated', { legalMoves: legalMovesStr(room.game) });

        if (room.game.isFinished) {
          room.status = 'finished';
          io.to(roomId).emit('game-finished', buildClientState(room));
        } else {
          room.game.startTurn();
        }

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('place-piece error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- resign ----------------------------------------------------------
    socket.on('resign', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room || room.roomId !== roomId) throw new Error('Invalid room');

        // 投了者の相手を勝ちにする
        const winnerId =
          room.host.id === socket.id
            ? room.guest && room.guest.id
            : room.host.id;
        room.resignWinnerId = winnerId || null;
        if (room.game) room.game.clearTurnTimeout();
        roomManager.finishGame(roomId);
        console.log(`Player ${socket.id} resigned from ${roomId}`);

        io.to(roomId).emit('game-finished', buildClientState(room));
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('resign error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- leave-room ------------------------------------------------------
    socket.on('leave-room', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        socket.leave(roomId);
        roomManager.leaveRoom(roomId);
        console.log(`Player ${socket.id} left ${roomId}`);
        emitRoomsUpdated(io, roomManager, playerNames);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('leave-room error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- disconnect ------------------------------------------------------
    socket.on('disconnect', () => {
      try {
        console.log(`User disconnected: ${socket.id}`);
        const room = roomManager.getPlayerRoom(socket.id);
        if (room && room.status === 'playing') {
          io.to(room.roomId).emit('opponent-disconnected');
          roomManager.leaveRoom(room.roomId);
        } else if (room) {
          roomManager.leaveRoom(room.roomId);
        }
        playerNames.delete(socket.id);
        io.emit('online-count-updated', { onlineCount: playerNames.size });
        emitRoomsUpdated(io, roomManager, playerNames);
      } catch (error) {
        console.error('disconnect error:', error);
      }
    });
  });
}

// 募集中/対戦中/オンライン人数をまとめる
function buildRoomsPayload(roomManager, playerNames) {
  const waiting = roomManager.getWaitingRooms().map((room) => ({
    roomId: room.roomId,
    hostName: room.host.name,
  }));
  const playing = roomManager.getPlayingRooms().map((room) => ({
    player1: room.host.name,
    player2: room.guest ? room.guest.name : 'Waiting...',
  }));
  return { waiting, playing, onlineCount: playerNames.size };
}

function emitRoomsUpdated(io, roomManager, playerNames) {
  io.emit('rooms-updated', buildRoomsPayload(roomManager, playerNames));
}

module.exports = registerSocketHandlers;
