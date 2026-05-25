# Docker 部署指南

本应用已准备好通过 Docker 进行部署。

## 前置要求

- Docker（版本 20.10+）
- Docker Compose（版本 1.29+）

## 快速开始

### 1. 构建并运行 Docker 容器

```bash
# 构建镜像
docker build -t inventory-management .

# 运行容器
docker run -p 3000:3000 -v $(pwd)/data:/app/data inventory-management
```

### 2. 使用 Docker Compose（推荐）

```bash
# 启动应用（生产环境）
docker-compose up -d

# 停止应用
docker-compose down

# 查看日志
docker-compose logs -f app
```

## 环境变量

创建 `.env` 文件或在 docker-compose.yml 中配置：

```env
NODE_ENV=production
PORT=3000
DB_PATH=/app/data/inventory.db
```

## 数据持久化

数据库文件存储在 `./data` 目录（通过 Docker volume 挂载），即使容器重启也会保留数据。

## 开发环境

对于开发，使用开发 profile：

```bash
# 启动开发容器（包含热重载）
docker-compose --profile dev up dev

# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 容器详情

- **基础镜像**: node:20-alpine（轻量级）
- **工作目录**: /app
- **暴露端口**: 3000
- **进程**: Node.js Express 服务器

## 故障排除

### 端口已被占用
```bash
docker run -p 8000:3000 inventory-management
# 访问 http://localhost:8000
```

### 查看容器日志
```bash
docker logs <container-id>
```

### 进入容器调试
```bash
docker exec -it <container-id> sh
```

## 生产部署注意事项

1. **设置 NODE_ENV=production** - 优化性能
2. **使用卷挂载数据库** - 确保数据持久化
3. **定期备份数据** - 备份 ./data 目录
4. **配置日志收集** - 可选：集成 ELK 或其他日志系统
5. **监控健康状态** - 定期检查应用状态

## 多容器部署

如需其他服务（如 PostgreSQL、Redis），请编辑 `docker-compose.yml` 添加服务。
