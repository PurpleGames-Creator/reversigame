FROM node:18-alpine

WORKDIR /app

# バックエンド（Root Directory が reversigame/server の場合、相対パスで指定）
COPY package*.json ./
RUN npm install

# Copy server source code
COPY . ./server

EXPOSE 3001

CMD ["npm", "start"]
