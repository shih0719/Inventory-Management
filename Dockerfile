# 使用 Node.js 20 官方輕量像鏡像
FROM node:20-alpine

# 安裝 git (更新功能需要) 與 sqlite (如果本地編譯需要)
RUN apk add --no-cache git sqlite openssh

# 設定工作目錄
WORKDIR /app

# 複製 package 檔案並安裝依賴
COPY package*.json ./
RUN npm install

# 複製其餘程式碼 (排除 .dockerignore 中的內容)
COPY . .

# 曝露 API 埠號 (對應 .env 中的 PORT=3030)
EXPOSE 3030

# 啟動應用程式
CMD npm start
