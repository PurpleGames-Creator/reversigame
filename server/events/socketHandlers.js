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
  let matchQueue = []; // ランダムマッチ待ちの socket.id
  const privateWaiting = new Map(); // あいことば -> 待機中の socket.id

  // ---- 共有ヘルパ（socket に依存しないので接続スコープの外に置く） -------

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
        turnRemaining: null,
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
      // 手番の残り時間(ms)。クライアントは受信時刻に足してタイマー表示する
      // （エポックを送らないのは端末の時計ズレに影響されないため）
      turnRemaining:
        !s.isFinished && room.game.turnDeadline
          ? Math.max(0, room.game.turnDeadline - Date.now())
          : null,
    };
  };

  // "row,col" 文字列配列で合法手を返す
  const legalMovesStr = (game) =>
    getLegalMoves(game).map(([r, c]) => `${r},${c}`);

  // payload が {roomId} でも文字列でも roomId を取り出す
  const getRoomId = (payload) =>
    payload && typeof payload === 'object' ? payload.roomId : payload;

  // 手番タイマーを開始（時間切れになったら自動手を打ってクライアントへ配信）
  const scheduleTurn = (room) => {
    room.game.startTurn(() => handleTurnTimeout(room.roomId));
  };

  // 着手後の共通配信。
  // 次手番のタイマーを先に張ってから状態を配ることで turnRemaining を新鮮に保つ。
  // 着手しても手番が動かなければ相手がパスしたということなので通知する。
  const broadcastAfterMove = (room, moverColor) => {
    const game = room.game;
    if (!game.isFinished) {
      scheduleTurn(room);
    }

    io.to(room.roomId).emit('board-updated', buildClientState(room));
    io.to(room.roomId).emit('legal-moves-updated', { legalMoves: legalMovesStr(game) });

    if (!game.isFinished && game.currentPlayer === moverColor) {
      const passed = moverColor === 'black' ? room.guest : room.host;
      if (passed) {
        io.to(room.roomId).emit('turn-passed', {
          playerId: passed.id,
          playerName: passed.name,
        });
      }
    }

    if (game.isFinished) {
      room.status = 'finished';
      io.to(room.roomId).emit('game-finished', buildClientState(room));
    }
  };

  // 時間切れ：ランダムな合法手を自動で打ち（打てなければパス）、結果を配信する
  const handleTurnTimeout = (roomId) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.game || room.status !== 'playing' || room.game.isFinished) return;

      const timedOutColor = room.game.currentPlayer;
      const timedOut = timedOutColor === 'black' ? room.host : room.guest;
      const result = room.game.autoMove();
      if (result.type === 'move') {
        room.lastMove = { row: result.row, col: result.col };
      }
      console.log(`Turn timeout in ${roomId}: ${timedOut ? timedOut.name : '?'} -> ${result.type}`);

      io.to(roomId).emit('turn-timeout', {
        playerId: timedOut ? timedOut.id : null,
        playerName: timedOut ? timedOut.name : '',
        move: result.type === 'move' ? { row: result.row, col: result.col } : null,
      });
      broadcastAfterMove(room, timedOutColor);
    } catch (error) {
      console.error('turn-timeout error:', error);
    }
  };

  // 対局開始（初戦・再戦共通）の配信
  const startGame = (room) => {
    scheduleTurn(room);
    io.to(room.roomId).emit('game-started', buildClientState(room));
    io.to(room.roomId).emit('legal-moves-updated', { legalMoves: legalMovesStr(room.game) });
  };

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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

    // ---- find-match（ランダムマッチング） --------------------------------
    socket.on('find-match', (callback) => {
      try {
        const name = playerNames.get(socket.id);
        if (!name) throw new Error('Player not registered');

        // 二重登録を除去
        matchQueue = matchQueue.filter((id) => id !== socket.id);

        // 待機中の相手を探す（切断済みは飛ばす）
        let opponentId = null;
        while (matchQueue.length > 0) {
          const cand = matchQueue.shift();
          if (cand !== socket.id && io.sockets.sockets.get(cand)) {
            opponentId = cand;
            break;
          }
        }

        if (opponentId) {
          // 待っていた方を host(先手/白)、来た方を guest にして対局開始
          const oppName = playerNames.get(opponentId) || 'Player';
          const roomId = roomManager.createRoom(opponentId, oppName);
          const oppSocket = io.sockets.sockets.get(opponentId);
          if (oppSocket) oppSocket.join(roomId);
          const room = roomManager.joinRoom(roomId, socket.id, name);
          socket.join(roomId);
          room.lastMove = null;
          console.log(`Matched: ${oppName} vs ${name} (${roomId})`);

          io.to(roomId).emit('matched', { roomId });
          startGame(room);
          emitRoomsUpdated(io, roomManager, playerNames);

          if (callback) callback({ success: true, matched: true, roomId });
        } else {
          // 相手が居なければ待機列へ
          matchQueue.push(socket.id);
          if (callback) callback({ success: true, matched: false });
        }
      } catch (error) {
        console.error('find-match error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- cancel-match ----------------------------------------------------
    socket.on('cancel-match', (callback) => {
      matchQueue = matchQueue.filter((id) => id !== socket.id);
      if (callback) callback({ success: true });
    });

    // ---- private-match（合言葉マッチング） ------------------------------
    socket.on('private-match', (payload, callback) => {
      try {
        const name = playerNames.get(socket.id);
        if (!name) throw new Error('Player not registered');
        const code = String((payload && payload.code) || '').trim().slice(0, 32);
        if (!code) throw new Error('あいことばを入力してください');

        // 自分が別コードで待機中なら解除（重複防止）
        for (const [k, v] of privateWaiting) {
          if (v === socket.id) privateWaiting.delete(k);
        }

        const waiterId = privateWaiting.get(code);
        if (waiterId && waiterId !== socket.id && io.sockets.sockets.get(waiterId)) {
          // 同じ合言葉の相手が居た → その2人で対局開始
          privateWaiting.delete(code);
          const oppName = playerNames.get(waiterId) || 'Player';
          const roomId = roomManager.createRoom(waiterId, oppName); // 先に待っていた方=host(白/先手)
          const oppSocket = io.sockets.sockets.get(waiterId);
          if (oppSocket) oppSocket.join(roomId);
          const room = roomManager.joinRoom(roomId, socket.id, name);
          socket.join(roomId);
          room.lastMove = null;
          console.log(`Private matched (${code}): ${oppName} vs ${name} (${roomId})`);

          io.to(roomId).emit('matched', { roomId });
          startGame(room);
          emitRoomsUpdated(io, roomManager, playerNames);

          if (callback) callback({ success: true, matched: true, roomId });
        } else {
          // 相手待ち（この合言葉で待機）
          privateWaiting.set(code, socket.id);
          if (callback) callback({ success: true, matched: false });
        }
      } catch (error) {
        console.error('private-match error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- cancel-private --------------------------------------------------
    socket.on('cancel-private', (payload, callback) => {
      const code = String((payload && payload.code) || '').trim().slice(0, 32);
      if (code) {
        if (privateWaiting.get(code) === socket.id) privateWaiting.delete(code);
      } else {
        for (const [k, v] of privateWaiting) {
          if (v === socket.id) privateWaiting.delete(k);
        }
      }
      if (callback) callback({ success: true });
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
        startGame(room);
        emitRoomsUpdated(io, roomManager, playerNames);

        if (callback) callback({ success: true, roomId, gameState: buildClientState(room) });
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

        broadcastAfterMove(room, myColor);

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

    // ---- request-rematch -------------------------------------------------
    socket.on('request-rematch', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room || room.roomId !== roomId) throw new Error('Invalid room');
        if (!room.guest) throw new Error('相手がいません');

        room.rematchVotes = room.rematchVotes || new Set();
        room.rematchVotes.add(socket.id);

        // 相手に「再戦希望」を通知
        socket.to(roomId).emit('rematch-requested', { by: socket.id });

        // 両者そろったらリセットして再開
        if (room.rematchVotes.has(room.host.id) && room.rematchVotes.has(room.guest.id)) {
          room.rematchVotes.clear();
          room.lastMove = null;
          room.resignWinnerId = null;
          roomManager.resetGame(roomId);
          startGame(room);
          emitRoomsUpdated(io, roomManager, playerNames);
        }
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('request-rematch error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- get-live-games（観戦できる進行中の対戦一覧） --------------------
    socket.on('get-live-games', (callback) => {
      try {
        const games = roomManager.getPlayingRooms().map((room) => ({
          roomId: room.roomId,
          player1: room.host.name,
          player2: room.guest ? room.guest.name : '—',
        }));
        if (callback) callback({ games });
      } catch (error) {
        console.error('get-live-games error:', error);
        if (callback) callback({ games: [], error: error.message });
      }
    });

    // ---- spectate（観戦：プレイヤーにはならずルームの更新だけ受信） -------
    socket.on('spectate', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const room = roomManager.getRoom(roomId);
        if (!room || !room.game) throw new Error('その対戦は見つかりません');
        socket.join(roomId); // 更新配信を受け取るためルームに参加（playerToRoomには入れない）
        console.log(`Spectator ${socket.id} watching ${roomId}`);
        if (callback) callback({ success: true, state: buildClientState(room) });
      } catch (error) {
        console.error('spectate error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- leave-spectate --------------------------------------------------
    socket.on('leave-spectate', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        socket.leave(roomId);
        if (callback) callback({ success: true });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- leave-room ------------------------------------------------------
    socket.on('leave-room', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const room = roomManager.getPlayerRoom(socket.id);
        // 対局相手が居る部屋を抜けるなら相手に通知（再戦待ちの相手が固まらないように）
        if (room && room.host && room.guest) {
          socket.to(roomId).emit('opponent-disconnected');
        }
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
        matchQueue = matchQueue.filter((id) => id !== socket.id);
        for (const [k, v] of privateWaiting) {
          if (v === socket.id) privateWaiting.delete(k);
        }
        const room = roomManager.getPlayerRoom(socket.id);
        if (room) {
          // 対局相手が居れば（対局中でも終局後の再戦待ちでも）通知
          if (room.host && room.guest) {
            io.to(room.roomId).emit('opponent-disconnected');
          }
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
    roomId: room.roomId,
    player1: room.host.name,
    player2: room.guest ? room.guest.name : 'Waiting...',
  }));
  return { waiting, playing, onlineCount: playerNames.size };
}

function emitRoomsUpdated(io, roomManager, playerNames) {
  io.emit('rooms-updated', buildRoomsPayload(roomManager, playerNames));
}

module.exports = registerSocketHandlers;
