# Build context: repo root (fly deploy --config apps/api/fly.toml from repo root)

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all workspace package.json files for npm ci to resolve the lock file
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/portal/package.json ./apps/portal/
COPY packages/db/package.json ./packages/db/
COPY packages/mcp-plugin/package.json ./packages/mcp-plugin/

RUN npm install --workspace=apps/api --workspace=packages/db --ignore-scripts

# Prisma generate (schema lives in packages/db)
COPY packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Compile TypeScript
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN cd apps/api && npm run build


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Re-install production deps only
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/portal/package.json ./apps/portal/
COPY packages/db/package.json ./packages/db/
COPY packages/mcp-plugin/package.json ./packages/mcp-plugin/

RUN npm install --workspace=apps/api --workspace=packages/db --ignore-scripts --omit=dev

# Prisma client (must be generated in the runtime image too)
COPY packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
