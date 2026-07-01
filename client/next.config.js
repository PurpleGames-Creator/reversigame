/** @type {import('next').NextConfig} */
// DEPLOY_TARGET=pages のときだけ GitHub Pages 向けの静的書き出し設定を有効化する。
// （通常の dev / Vercel ビルドには影響しない）
const isPages = process.env.DEPLOY_TARGET === "pages";
const repo = "reversigame"; // GitHub Pages のプロジェクトパス（/reversigame/ で配信）

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  ...(isPages
    ? {
        output: "export",
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;
