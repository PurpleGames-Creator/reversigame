const ReversiGame = require('../game/ReversiGame');

/**
 * RoomManager - Room and player connection management
 *
 * Manages:
 * - Room creation and deletion
 * - Player-to-room mapping
 * - Game state for each room
 * - Room status tracking (waiting, playing, finished)
 */
class RoomManager {
  constructor() {
    /**
     * Map of all active rooms
     * Key: roomId
     * Value: Room object {
     *   roomId: string,
     *   host: { id, name },
     *   guest: { id, name } | null,
     *   game: ReversiGame | null,
     *   status: 'waiting' | 'playing' | 'finished'
     * }
     */
    this.rooms = new Map();

    /**
     * Map of player to room mapping
     * Key: playerId
     * Value: roomId
     */
    this.playerToRoom = new Map();

    /**
     * Counter for generating unique room IDs
     */
    this.roomCounter = 0;
  }

  /**
   * Create a new game room
   *
   * @param {string} hostId - Host player ID
   * @param {string} hostName - Host player name
   * @returns {string} Generated roomId
   * @throws {Error} If room creation fails
   */
  createRoom(hostId, hostName, hostToken = null) {
    const roomId = `room_${++this.roomCounter}_${Date.now()}`;

    const room = {
      roomId,
      host: { id: hostId, name: hostName, token: hostToken, disconnected: false },
      guest: null,
      game: null,
      status: 'waiting',
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(hostId, roomId);

    return roomId;
  }

  /**
   * Join an existing waiting room
   *
   * @param {string} roomId - Room ID to join
   * @param {string} guestId - Guest player ID
   * @param {string} guestName - Guest player name
   * @returns {Object} Updated room object
   * @throws {Error} If room not found or not available
   */
  joinRoom(roomId, guestId, guestName, guestToken = null) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Room is not available');
    }

    // Set guest and initialize game
    room.guest = { id: guestId, name: guestName, token: guestToken, disconnected: false };
    room.game = new ReversiGame(room.host, room.guest);
    room.status = 'playing';

    // Map guest to room
    this.playerToRoom.set(guestId, roomId);

    return room;
  }

  /**
   * Reset a finished room's game for a rematch (same host/guest)
   *
   * @param {string} roomId
   * @returns {Object} Updated room object
   * @throws {Error} If room/players not available
   */
  resetGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.host || !room.guest) {
      throw new Error('Rematch not available');
    }
    if (room.game) {
      room.game.clearTurnTimeout();
    }
    room.game = new ReversiGame(room.host, room.guest);
    room.status = 'playing';
    return room;
  }

  /**
   * Remove a room and all associated mappings
   * Called when game is finished and players leave
   *
   * @param {string} roomId - Room ID to leave/delete
   */
  leaveRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Stop any pending turn timer so the orphaned game can't keep auto-moving
    if (room.game) {
      room.game.clearTurnTimeout();
    }

    // Stop pending disconnect-grace timers (set by the socket layer)
    for (const side of ['host', 'guest']) {
      if (room[side] && room[side].graceTimeoutId) {
        clearTimeout(room[side].graceTimeoutId);
        room[side].graceTimeoutId = null;
      }
    }

    // Remove player mappings
    if (room.host) {
      this.playerToRoom.delete(room.host.id);
    }
    if (room.guest) {
      this.playerToRoom.delete(room.guest.id);
    }

    // Delete room
    this.rooms.delete(roomId);
  }

  /**
   * Reconnect a disconnected player under a new socket id.
   * Identified by the persistent player token (socket.io auth), so a page
   * reload or network blip within the grace period can resume the game.
   *
   * @param {string} roomId
   * @param {string} token - Persistent player token
   * @param {string} newId - New socket id
   * @returns {{ room: Object, side: 'host'|'guest', player: Object }|null}
   */
  reconnectPlayer(roomId, token, newId) {
    const room = this.rooms.get(roomId);
    if (!room || !token) return null;

    let side = null;
    if (room.host && room.host.token === token) side = 'host';
    else if (room.guest && room.guest.token === token) side = 'guest';
    if (!side) return null;

    const player = room[side];
    // 接続中プレイヤーの乗っ取り防止：切断中の本人だけ復帰できる
    if (!player.disconnected) return null;

    this.playerToRoom.delete(player.id);
    player.id = newId;
    player.disconnected = false;
    this.playerToRoom.set(newId, roomId);

    return { room, side, player };
  }

  /**
   * Get the room for a specific player
   *
   * @param {string} playerId - Player ID to look up
   * @returns {Object|null} Room object or null if not found
   */
  getPlayerRoom(playerId) {
    const roomId = this.playerToRoom.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  /**
   * Get a room by its ID (for spectators)
   *
   * @param {string} roomId
   * @returns {Object|null}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all rooms waiting for guests
   *
   * @returns {Array} Array of waiting room objects
   */
  getWaitingRooms() {
    return Array.from(this.rooms.values()).filter(room => room.status === 'waiting');
  }

  /**
   * Get all rooms currently playing
   *
   * @returns {Array} Array of playing room objects
   */
  getPlayingRooms() {
    return Array.from(this.rooms.values()).filter(room => room.status === 'playing');
  }

  /**
   * Get the number of online/connected players
   *
   * @returns {number} Count of connected players
   */
  getOnlineCount() {
    return this.playerToRoom.size;
  }

  /**
   * Execute a move in the game
   *
   * @param {string} roomId - Room ID
   * @param {number} row - Board row (0-7)
   * @param {number} col - Board column (0-7)
   * @returns {Object} Serialized game state
   * @throws {Error} If room or game not found
   */
  makeMove(roomId, row, col) {
    const room = this.rooms.get(roomId);

    if (!room || !room.game) {
      throw new Error('Room or game not found');
    }

    room.game.move(row, col);
    return room.game.serialize();
  }

  /**
   * Finish the game (e.g., player resignation)
   *
   * @param {string} roomId - Room ID
   * @returns {Object} Serialized final game state
   * @throws {Error} If room or game not found
   */
  finishGame(roomId) {
    const room = this.rooms.get(roomId);

    if (!room || !room.game) {
      throw new Error('Room or game not found');
    }

    room.game.finish();
    room.status = 'finished';
    return room.game.serialize();
  }
}

module.exports = RoomManager;
