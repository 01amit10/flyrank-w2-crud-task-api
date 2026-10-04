# Multi-stage Dockerfile for optimized production image size
# Stage 1: Build & install production dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Minimal production runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js db.js openapi.json ./

EXPOSE 3000
USER node
CMD ["node", "server.js"]
