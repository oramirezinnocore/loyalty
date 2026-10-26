# Multi-stage build for IntusPath Loyalty production deployment

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy Prisma CLI for migrations (needed for prisma migrate deploy)
# Must copy complete package with all assets (WASM, binaries, build dir)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Recreate .bin symlink for Prisma CLI (npm normally creates this)
# The symlink must point to ../prisma/build/index.js so WASM files resolve correctly
RUN mkdir -p node_modules/.bin && \
    ln -sf ../prisma/build/index.js node_modules/.bin/prisma && \
    chown -h nextjs:nodejs node_modules/.bin/prisma

# Verify Prisma CLI works at build time (catches packaging issues early)
RUN node_modules/.bin/prisma --version

# Create Next.js cache directory with correct ownership
# The nextjs user needs write access for runtime cache
RUN mkdir -p .next/cache && \
    chown -R nextjs:nodejs .next/cache

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
