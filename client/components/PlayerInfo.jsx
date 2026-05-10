export default function PlayerInfo({ player1, player2, currentPlayer }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mx-4 mt-4">
      <div className="flex items-center justify-between gap-4">
        {/* Player 1 (White) */}
        <div className={`flex-1 text-center transition-colors ${
          currentPlayer === player1?.id ? 'bg-yellow-100 p-3 rounded-lg' : ''
        }`}>
          <p className="text-sm font-medium text-gray-600">白</p>
          <p className="text-lg font-bold text-gray-800 mb-2">
            {player1?.name || '待機中'}
          </p>
          <p className="text-2xl font-bold text-white bg-gray-400 rounded px-3 py-1 inline-block">
            {player1?.pieces || 0}
          </p>
        </div>

        {/* VS */}
        <div className="text-gray-400 font-bold text-2xl">VS</div>

        {/* Player 2 (Purple) */}
        <div className={`flex-1 text-center transition-colors ${
          currentPlayer === player2?.id ? 'bg-yellow-100 p-3 rounded-lg' : ''
        }`}>
          <p className="text-sm font-medium text-gray-600">紫</p>
          <p className="text-lg font-bold text-gray-800 mb-2">
            {player2?.name || '待機中'}
          </p>
          <p className="text-2xl font-bold text-white bg-purple-500 rounded px-3 py-1 inline-block">
            {player2?.pieces || 0}
          </p>
        </div>
      </div>
    </div>
  );
}
