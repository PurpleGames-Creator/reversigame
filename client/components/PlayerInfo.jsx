export default function PlayerInfo({ player1, player2, currentPlayer }) {
  const Side = ({ player, color }) => {
    const active = currentPlayer === player?.id;
    const isWhite = color === 'white';
    return (
      <div
        className={`flex-1 rounded-2xl px-3 py-3 text-center transition-all duration-300 ${
          active ? 'bg-white/12 ring-1 ring-white/40' : 'bg-white/0'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: 12,
              height: 12,
              background: isWhite
                ? 'radial-gradient(circle at 30% 30%, #fff, #d7cff0)'
                : 'radial-gradient(circle at 30% 30%, #a78bfa, #6d28d9)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          />
          <p className="text-[11px] font-semibold tracking-wide text-white/55">
            {isWhite ? '白' : '紫'}
          </p>
        </div>
        <p className="text-sm font-semibold text-white truncate">
          {player?.name || '待機中'}
        </p>
        <p className="text-3xl font-bold text-white mt-0.5 tabular-nums">
          {player?.pieces ?? 0}
        </p>
      </div>
    );
  };

  return (
    <div className="glass rounded-3xl p-2 mx-4 mt-4">
      <div className="flex items-center gap-1">
        <Side player={player1} color="white" />
        <span className="text-white/35 font-medium text-xs px-1">VS</span>
        <Side player={player2} color="purple" />
      </div>
    </div>
  );
}
