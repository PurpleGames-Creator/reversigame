# Reversigame プロジェクト原則

CPU 戦 / ランダムマッチ / プライベート戦(合言葉) / 観戦モードのオンラインリバーシ。フロント(Next.js 静的) + サーバー(Node.js + socket.io) の 2 層構成。

## デプロイターゲット

### フロント: GitHub Pages
- `gh-pages` ブランチにビルド成果物を push
- basePath: `/reversigame`
- ビルドコマンド: `DEPLOY_TARGET=pages NEXT_PUBLIC_SOCKET_URL="https://purple-reversi.onrender.com" npm run build`
- 本番 URL: https://purplegames-creator.github.io/reversigame/

### バックエンド: Render Free
- URL: https://purple-reversi.onrender.com
- Free プランは無操作 15 分でスリープ、初回接続に **~50 秒**かかる(健康チェックは `/health`)
- Dockerfile 経由でデプロイ

## 接続先の切り替え
- クライアントの WebSocket 接続先は `NEXT_PUBLIC_SOCKET_URL`(ビルド時に埋め込む)
- 接続先を変えたら**フロントを再ビルド**してから push する
- 環境変数の値は Render / Vercel Dashboard または `.env.local`

## サーバー CORS 許可

- `localhost:*`
- `*.vercel.app`
- `*.github.io`

## 廃止済みで復活させない

- **Railway** は廃止(Render に一本化)
- 依頼が無い限り Railway 構成を復元しない

## 手続き

- client/server 個別のデプロイ手順: skill `/reversigame-deploy`(フェーズ3 で追加予定)
- 実装変更後の PRJ ノート更新: skill `/obsidian-note-sync`

## 関連ノート

- `05_Projects\PRJ_Reversigame_プロジェクト概要.md`
- memory インデックスの `Reversigame(Purpleリバーシ)` エントリ
