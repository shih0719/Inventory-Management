# 部署指南

## 本地开发

```bash
npm install
npm run dev
```

## 生产环境（使用 PM2）

### 1. 安装 PM2
```bash
npm install -g pm2
```

### 2. 启动应用
```bash
# 方式一：使用 npm 脚本
npm run pm2:start

# 方式二：使用 PM2 配置文件
pm2 start ecosystem.config.js
```

### 3. 查看应用状态
```bash
pm2 status
pm2 logs inventory-api
```

### 4. 停止/重启应用
```bash
npm run pm2:stop      # 停止
npm run pm2:restart   # 重启
npm run pm2:delete    # 删除
```

### 5. 开机自启（可选）
```bash
pm2 startup
pm2 save
```

## 自动更新流程

1. 用户在网页 UI 点击"更新"按钮
2. 应用执行以下步骤：
   - `git fetch` 和 `git reset --hard origin/main`
   - `npm install --production`
   - 重新加载版本信息
3. 应用重启（PM2 自动重启）
4. 用户刷新页面看到新版本

## 日志文件

- 应用日志：`logs/out.log`
- 错误日志：`logs/error.log`

## 手动更新（备选）

如果网页 UI 更新失败，可以手动执行：

```bash
git fetch origin
git reset --hard origin/main
npm install --production
npm run pm2:restart
```
