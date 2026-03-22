# Build context: apps/api/ (Fly.io web UI deploys from the fly.toml directory)

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
