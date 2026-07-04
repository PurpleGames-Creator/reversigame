import { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { playClick, unlockAudio } from '../lib/sound';

// ⚠️ ここで socket を張らない：ページ側の lib/socket.js (initSocket) が唯一の接続。
// 以前は _app でも独自に io() を張っていて1人2接続になり、オンライン人数が水増しされていた。

function MyApp({ Component, pageProps }) {
  // サイト全体：ボタン押下で「カチっ」というクリック音（盤面のマスは配置音があるので除外）
  useEffect(() => {
    const onDown = (e) => {
      unlockAudio();
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest('button, [role="button"], a');
      if (!el || el.disabled) return;
      if (el.closest('[data-no-uisound]')) return;
      playClick();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="true" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#2a0f4c" />

        {/* 基本 */}
        <title>Purple Reversi｜パプ子と対戦・オンライン対戦</title>
        <meta
          name="description"
          content="シンプルな対戦リバーシ。CPU（パプ子）とすぐ遊べて、友達とオンライン対戦もできる。"
        />
        <link rel="icon" href="https://purplegames-creator.github.io/reversigame/paputaro.png" />
        <link rel="apple-touch-icon" href="https://purplegames-creator.github.io/reversigame/paputaro.png" />
        {/* PWA（ホーム画面に追加でアプリのように起動） */}
        <link rel="manifest" href="https://purplegames-creator.github.io/reversigame/manifest.json" />

        {/* OGP（SNSシェア） */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Purple Games" />
        <meta property="og:title" content="Purple Reversi｜パプ子と対戦・オンライン対戦" />
        <meta
          property="og:description"
          content="シンプルな対戦リバーシ。CPU（パプ子）とすぐ遊べて、友達とオンライン対戦もできる。"
        />
        <meta property="og:url" content="https://purplegames-creator.github.io/reversigame/" />
        <meta property="og:image" content="https://purplegames-creator.github.io/reversigame/paputaro.png" />
        <meta property="og:image:width" content="489" />
        <meta property="og:image:height" content="496" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Purple Reversi｜パプ子と対戦・オンライン対戦" />
        <meta
          name="twitter:description"
          content="シンプルな対戦リバーシ。CPU（パプ子）とすぐ遊べて、友達とオンライン対戦もできる。"
        />
        <meta name="twitter:image" content="https://purplegames-creator.github.io/reversigame/paputaro.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* 軽量アクセス解析（GoatCounter）。ビルド時に NEXT_PUBLIC_GOATCOUNTER=<サイトコード> を
            設定した場合だけ有効。未設定なら何も読み込まない */}
        {process.env.NEXT_PUBLIC_GOATCOUNTER && (
          <script
            data-goatcounter={`https://${process.env.NEXT_PUBLIC_GOATCOUNTER}.goatcounter.com/count`}
            async
            src="https://gc.zgo.at/count.js"
          />
        )}
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
