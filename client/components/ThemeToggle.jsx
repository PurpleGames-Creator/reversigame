import { getBoardTheme, setBoardTheme } from '../lib/storage';

const ORDER = ['purple', 'green', 'wood'];
const LABELS = { purple: '紫', green: 'クラシック緑', wood: '木目' };

// 盤面テーマの切り替え（🎨タップで 紫→緑→木目 を循環。SoundToggleの左隣に固定）
export default function ThemeToggle({ theme, onChange }) {
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      onClick={() => {
        setBoardTheme(next);
        onChange(next);
      }}
      aria-label={`盤面テーマを${LABELS[next]}に変更`}
      title={`盤面テーマ: ${LABELS[theme] || '紫'}（タップで${LABELS[next]}）`}
      className="fixed z-40 w-10 h-10 rounded-full glass flex items-center justify-center text-base transition-opacity hover:opacity-80"
      style={{
        // サウンドボタン(右上)の真下に縦に並べる
        top: 'calc(max(0.9rem, env(safe-area-inset-top)) + 3.1rem)',
        right: 'max(0.9rem, env(safe-area-inset-right))',
      }}
    >
      🎨
    </button>
  );
}

export { getBoardTheme };
