const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const registerSocketHandlers = require('./events/socketHandlers');

const app = express();
const httpServer = createServer(app);
// 許可オリジン：環境変数 CLIENT_ORIGIN（カンマ区切り）があればそれを使う。
// 無ければ localhost / *.vercel.app / *.github.io を許可（フロントの再デプロイでURLが変わっても壊れない）。
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const corsOrigin = (origin, callback) => {
  // サーバ間/ツール等 origin 無しは許可
  if (!origin) return callback(null, true);
  if (allowedOrigins) return callback(null, allowedOrigins.includes(origin));
  const host = new URL(origin).hostname;
  const ok =
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /\.vercel\.app$/.test(host) ||
    /\.github\.io$/.test(host);
  return callback(null, ok);
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Register Socket.io event handlers
const handlersApi = registerSocketHandlers(io);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 現在の接続人数（Purple Park HPの「現在〇人がオンライン」表示用）
app.get('/online', (req, res) => {
  res.json({ count: handlersApi.getOnlineCount() });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
