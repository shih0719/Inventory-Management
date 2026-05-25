# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/vite-app

COPY vite-app/package*.json ./

RUN npm ci

COPY vite-app/ .

RUN npm run build

# Build backend and final image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY server.js .
COPY src/ ./src/
COPY database/ ./database/
COPY scripts/ ./scripts/
COPY --from=frontend-builder /app/vite-app/dist ./public

# Ensure data directory exists
RUN mkdir -p /app/data

EXPOSE 3000

# Healthcheck (requires curl to be installed)
# Uncomment if you want to enable healthcheck
# HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
#   CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
