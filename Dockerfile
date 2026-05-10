FROM node:18-alpine

WORKDIR /app

# バックエンド
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install
WORKDIR /app

# フロントエンド
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install
WORKDIR /app

# ソースコードコピー
COPY server ./server
COPY client ./client

EXPOSE 3000 3001

CMD ["npm", "run", "dev:server"]
