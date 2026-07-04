export default function PlayerInfo({ player1, player2, currentPlayer, bubbles }) {
  const Side = ({ player, color }) => {
    const active = currentPlayer === player?.id;
    const isWhite = color === 'white';
    const bubble = bubbles && player?.id ? bubbles[player.id] : null;
    return (
      <div
        className={`relative flex-1 rounded-2xl px-3 py-3 text-center transition-all duration-300 ${
          active ? 'bg-white/12 ring-1 ring-white/40' : 'bg-white/0'
        }`}
      >
        {/* スタンプ吹き出し（keyで毎回アニメーションし直す） */}
        {bubble && (
          <div key={bubble.key} className="stamp-bubble">
            {bubble.text}
          </div>
        )}
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
          <p className="text-[11px] font-semibold tracking-wide text-white/70">
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

  // 石数の比率バー（どちらが優勢か一目でわかる）
  const p1 = player1?.pieces ?? 0;
  const p2 = player2?.pieces ?? 0;
  const total = p1 + p2;
  const whitePct = total > 0 ? (p1 / total) * 100 : 50;

  return (
    <div className="glass rounded-3xl p-2 mx-4 mt-4">
      <div className="flex items-center gap-1">
        <Side player={player1} color="white" />
        <span className="text-white/50 font-medium text-xs px-1">VS</span>
        <Side player={player2} color="purple" />
      </div>
      <div className="mx-2 mt-1 mb-1 h-1.5 rounded-full overflow-hidden flex bg-white/10">
        <div
          className="h-full"
          style={{
            width: `${whitePct}%`,
            background: 'linear-gradient(90deg, #ffffff, #d7cff0)',
            transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <div
          className="h-full flex-1"
          style={{ background: 'linear-gradient(90deg, #8b5cf6, #6d28d9)' }}
        />
      </div>
    </div>
  );
}
