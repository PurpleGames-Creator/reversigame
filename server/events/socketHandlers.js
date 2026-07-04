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
// 対局中に切断したプレイヤーの復帰を待つ猶予時間
const GRACE_MS = 30000;

// オンライン対戦（ランダムマッチ）の開催時間: 毎日21:00〜24:00 JST
// プライベート戦・観戦は対象外。クライアント側もロック表示するが、ここが最終ガード。
const isOnlineHours = () => {
  // ローカル開発・E2E用の常時開放スイッチ（本番Renderでは未設定）
  if (process.env.ONLINE_HOURS_ALWAYS === '1') return true;
  const jstHour = (new Date().getUTCHours() + 9) % 24;
  return jstHour >= 21;
};

function registerSocketHandlers(io) {
  const roomManager = new RoomManager();
  const playerNames = new Map(); // socket.id -> name
  let matchQueue = []; // ランダムマッチ待ちの socket.id
  const privateWaiting = new Map(); // あいことば -> 待機中の socket.id

  // socket.io の auth に載る永続プレイヤートークン（再接続時の本人特定用）
  const tokenOf = (s) =>
    (s && s.handshake && s.handshake.auth && s.handshake.auth.token) || null;

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
        series: room.series
          ? { player1: room.series.host, player2: room.series.guest, draw: room.series.draw }
          : null,
        spectatorCount: room.spectators ? room.spectators.size : 0,
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
      // 再戦をまたぐ通算成績（player1=host / player2=guest 視点）
      series: room.series
        ? { player1: room.series.host, player2: room.series.guest, draw: room.series.draw }
        : null,
      spectatorCount: room.spectators ? room.spectators.size : 0,
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

  // 終局した対局を通算成績に加算する（再戦しても持ち越し。二重加算はフラグで防止）
  const recordResult = (room) => {
    if (!room || !room.game || !room.series || room.seriesCounted || !room.guest) return;
    const s = room.game.serialize();
    if (!s.isFinished) return;
    let key = 'draw';
    if (room.resignWinnerId) {
      key = room.resignWinnerId === room.host.id ? 'host' : 'guest';
    } else if (s.winner === 'black') {
      key = 'host';
    } else if (s.winner === 'white') {
      key = 'guest';
    }
    room.series[key] += 1;
    room.seriesCounted = true;
  };

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
      recordResult(room);
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

  // 切断グレース期間が切れた：切断した側の負けで終局
  const forfeitByDisconnect = (roomId, side) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.game || room.status !== 'playing') return;
      const loser = room[side];
      if (!loser || !loser.disconnected) return;

      const winner = side === 'host' ? room.guest : room.host;
      room.resignWinnerId = (winner && winner.id) || null;
      room.game.clearTurnTimeout();
      roomManager.finishGame(roomId);
      recordResult(room);
      console.log(`Forfeit by disconnect in ${roomId}: ${loser.name}`);

      io.to(roomId).emit('game-finished', buildClientState(room));
      io.to(roomId).emit('opponent-disconnected');
    } catch (error) {
      console.error('forfeit error:', error);
    }
  };

  // 対局開始（初戦・再戦共通）の配信
  const startGame = (room) => {
    scheduleTurn(room);
    io.to(room.roomId).emit('game-started', buildClientState(room));
    io.to(room.roomId).emit('legal-moves-updated', { legalMoves: legalMovesStr(room.game) });
  };

  // オンライン人数＝接続中の全クライアント数（名前登録の有無を問わない）
  // io.engine.clientsCount は disconnect ハンドラ時点で未減算のため自前で数える
  const connectedIds = new Set();
  const emitOnlineCount = () => {
    io.emit('online-count-updated', { onlineCount: connectedIds.size });
  };

  // 観戦者の所在（socket.id -> roomId）。切断時のカウント減算に使う
  const spectatorRooms = new Map();
  const removeSpectator = (socketId) => {
    const roomId = spectatorRooms.get(socketId);
    if (!roomId) return;
    spectatorRooms.delete(socketId);
    const room = roomManager.getRoom(roomId);
    if (room && room.spectators && room.spectators.delete(socketId)) {
      io.to(roomId).emit('spectators-updated', { count: room.spectators.size });
    }
  };

  // 定型スタンプ（自由入力は受け付けない）
  const STAMPS = new Set(['yoroshiku', 'umm', 'wow', 'gg']);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    connectedIds.add(socket.id);
    emitOnlineCount();

    // ---- register --------------------------------------------------------
    socket.on('register', (playerName, callback) => {
      try {
        playerNames.set(socket.id, playerName);
        console.log(`Player registered: ${socket.id} - ${playerName}`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('register error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- get-rooms -------------------------------------------------------
    socket.on('get-rooms', (callback) => {
      try {
        if (callback) callback(buildRoomsPayload(roomManager, playerNames, connectedIds.size));
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

        const roomId = roomManager.createRoom(socket.id, playerName, tokenOf(socket));
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${playerName}`);

        emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);
        if (callback) callback({ roomId, success: true });
      } catch (error) {
        console.error('create-room error:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- find-match（ランダムマッチング） --------------------------------
    socket.on('find-match', (callback) => {
      try {
        if (!isOnlineHours()) {
          throw new Error('オンライン対戦は毎日21:00〜24:00に開催しています');
        }
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
          // コイントス：先手(白)=host をランダムに決める
          const oppName = playerNames.get(opponentId) || 'Player';
          const oppSocket = io.sockets.sockets.get(opponentId);
          const waiter = { id: opponentId, name: oppName, sock: oppSocket };
          const comer = { id: socket.id, name, sock: socket };
          const [hostP, guestP] = Math.random() < 0.5 ? [waiter, comer] : [comer, waiter];
          const roomId = roomManager.createRoom(hostP.id, hostP.name, tokenOf(hostP.sock));
          if (hostP.sock) hostP.sock.join(roomId);
          const room = roomManager.joinRoom(roomId, guestP.id, guestP.name, tokenOf(guestP.sock));
          if (guestP.sock) guestP.sock.join(roomId);
          room.lastMove = null;
          console.log(`Matched: ${hostP.name}(白) vs ${guestP.name} (${roomId})`);

          io.to(roomId).emit('matched', { roomId });
          startGame(room);
          emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);

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
          // 同じ合言葉の相手が居た → その2人で対局開始（コイントス：先手はランダム）
          privateWaiting.delete(code);
          const oppName = playerNames.get(waiterId) || 'Player';
          const oppSocket = io.sockets.sockets.get(waiterId);
          const waiter = { id: waiterId, name: oppName, sock: oppSocket };
          const comer = { id: socket.id, name, sock: socket };
          const [hostP, guestP] = Math.random() < 0.5 ? [waiter, comer] : [comer, waiter];
          const roomId = roomManager.createRoom(hostP.id, hostP.name, tokenOf(hostP.sock));
          if (hostP.sock) hostP.sock.join(roomId);
          const room = roomManager.joinRoom(roomId, guestP.id, guestP.name, tokenOf(guestP.sock));
          if (guestP.sock) guestP.sock.join(roomId);
          room.lastMove = null;
          console.log(`Private matched (${code}): ${hostP.name}(白) vs ${guestP.name} (${roomId})`);

          io.to(roomId).emit('matched', { roomId });
          startGame(room);
          emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);

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

        const room = roomManager.joinRoom(roomId, socket.id, playerName, tokenOf(socket));
        socket.join(roomId);
        room.lastMove = null;
        console.log(`Player ${playerName} joined room: ${roomId}`);

        // 対局開始を部屋の全員へ
        startGame(room);
        emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);

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
        recordResult(room);
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
          emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);
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
        if (callback)
          callback({ games: buildRoomsPayload(roomManager, playerNames, connectedIds.size).playing });
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
        room.spectators = room.spectators || new Set();
        room.spectators.add(socket.id);
        spectatorRooms.set(socket.id, roomId);
        console.log(`Spectator ${socket.id} watching ${roomId}`);
        io.to(roomId).emit('spectators-updated', { count: room.spectators.size });
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
        removeSpectator(socket.id);
        if (callback) callback({ success: true });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- send-stamp（定型スタンプ。対局者のみ・1.5秒間隔） ---------------
    socket.on('send-stamp', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const stamp = payload && payload.stamp;
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room || room.roomId !== roomId) throw new Error('Invalid room');
        if (!STAMPS.has(stamp)) throw new Error('Invalid stamp');

        const now = Date.now();
        if (socket.lastStampAt && now - socket.lastStampAt < 1500) {
          if (callback) callback({ success: false, error: 'too fast' });
          return;
        }
        socket.lastStampAt = now;

        io.to(roomId).emit('stamp', { playerId: socket.id, stamp });
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('send-stamp error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ---- rejoin-room（切断グレース中の復帰。トークンで本人を特定） --------
    socket.on('rejoin-room', (payload, callback) => {
      try {
        const roomId = getRoomId(payload);
        const token = tokenOf(socket);
        const room = roomManager.getRoom(roomId);
        if (!room || !room.game || !token) {
          throw new Error('この対局はすでに終了しています');
        }

        const rec = roomManager.reconnectPlayer(roomId, token, socket.id);
        if (!rec) throw new Error('この対局には再参加できません');

        if (rec.player.graceTimeoutId) {
          clearTimeout(rec.player.graceTimeoutId);
          rec.player.graceTimeoutId = null;
        }
        playerNames.set(socket.id, rec.player.name);
        socket.join(roomId);
        console.log(`Player ${rec.player.name} rejoined ${roomId}`);

        socket.to(roomId).emit('opponent-reconnected', { playerName: rec.player.name });

        // 手番タイマーを再開（切断中は止めていたのでフル20秒から）
        if (room.status === 'playing' && !room.game.isFinished) {
          scheduleTurn(room);
        }

        if (callback)
          callback({
            success: true,
            state: buildClientState(room),
            legalMoves: legalMovesStr(room.game),
          });
      } catch (error) {
        console.error('rejoin-room error:', error.message);
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
        emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);
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
          const side = room.host && room.host.id === socket.id ? 'host' : 'guest';
          const other = side === 'host' ? room.guest : room.host;
          const canGrace =
            room.status === 'playing' &&
            room.game &&
            !room.game.isFinished &&
            other &&
            !other.disconnected;

          if (canGrace) {
            // 対局中の切断：即破棄せずグレース期間だけ復帰(rejoin-room)を待つ。
            // 切断側が不利にならないよう手番タイマーは復帰まで止める。
            room[side].disconnected = true;
            room.game.clearTurnTimeout();
            io.to(room.roomId).emit('opponent-connection-lost', {
              playerId: socket.id,
              playerName: room[side].name,
              graceMs: GRACE_MS,
            });
            room[side].graceTimeoutId = setTimeout(
              () => forfeitByDisconnect(room.roomId, side),
              GRACE_MS
            );
          } else {
            // 対局前・終局後・両者切断：従来どおり部屋を破棄
            if (room.host && room.guest) {
              io.to(room.roomId).emit('opponent-disconnected');
            }
            roomManager.leaveRoom(room.roomId);
          }
        }
        removeSpectator(socket.id);
        playerNames.delete(socket.id);
        connectedIds.delete(socket.id);
        emitOnlineCount();
        emitRoomsUpdated(io, roomManager, playerNames, connectedIds.size);
      } catch (error) {
        console.error('disconnect error:', error);
      }
    });
  });
}

// 募集中/対戦中/オンライン人数をまとめる
function buildRoomsPayload(roomManager, playerNames, onlineCount) {
  const waiting = roomManager.getWaitingRooms().map((room) => ({
    roomId: room.roomId,
    hostName: room.host.name,
  }));
  // 観戦一覧用に石数・手数も同梱（get-live-games と rooms-updated で同じ形にし、
  // ポップアップ表示中の rooms-updated で行の形が変わってガタつくのを防ぐ）
  const playing = roomManager.getPlayingRooms().map((room) => {
    const s = room.game ? room.game.serialize() : null;
    return {
      roomId: room.roomId,
      player1: room.host.name,
      player2: room.guest ? room.guest.name : '—',
      pieces1: s ? s.blackCount : 2,
      pieces2: s ? s.whiteCount : 2,
      moves: s ? Math.max(0, s.blackCount + s.whiteCount - 4) : 0,
    };
  });
  return { waiting, playing, onlineCount };
}

function emitRoomsUpdated(io, roomManager, playerNames, onlineCount) {
  io.emit('rooms-updated', buildRoomsPayload(roomManager, playerNames, onlineCount));
}

module.exports = registerSocketHandlers;
