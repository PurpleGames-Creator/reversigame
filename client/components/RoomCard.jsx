export function WaitingRoomCard({ room, onJoin, loading }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-md flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-800">
          ホスト: <span className="font-bold text-blue-600">{room.hostName}</span>
        </p>
      </div>
      <button
        onClick={() => onJoin(room.roomId)}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "接続中..." : "入室"}
      </button>
    </div>
  );
}

export function PlayingRoomCard({ room }) {
  return (
    <div className="bg-gray-100 rounded-lg p-4 text-center">
      <p className="text-sm font-semibold text-gray-700">
        <span className="text-blue-600">{room.player1}</span>
        {" vs "}
        <span className="text-purple-600">{room.player2}</span>
      </p>
    </div>
  );
}
