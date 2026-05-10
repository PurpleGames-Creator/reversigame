FROM node:18-alpine

WORKDIR /app

# バックエンド（Root Directory が reversigame/server なので、相対パスで指定）
COPY package*.json ./
RUN npm install

# Copy server source code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
