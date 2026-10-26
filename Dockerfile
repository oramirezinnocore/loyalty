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

# Copy production admin bootstrap script
COPY --from=builder --chown=nextjs:nodejs /app/scripts/create-super-admin.js ./scripts/create-super-admin.js

# Copy bcryptjs (required by admin bootstrap, not traced by Next.js standalone)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Recreate .bin symlink for Prisma CLI (npm normally creates this)
# The symlink must point to ../prisma/build/index.js so WASM files resolve correctly
RUN mkdir -p node_modules/.bin && \
    ln -sf ../prisma/build/index.js node_modules/.bin/prisma && \
    chown -h nextjs:nodejs node_modules/.bin/prisma

# Verify Prisma CLI works at build time (catches packaging issues early)
RUN node_modules/.bin/prisma --version

# Create Next.js runtime directories with correct ownership
# The nextjs user needs write access for runtime cache, prerender cache, and route cache
# Next.js dynamically creates subdirectories under .next/ at runtime
RUN mkdir -p .next/cache .next/server && \
    chown -R nextjs:nodejs .next

# Create uploads directory for persistent business assets (logos)
# Mounted as named volume in production: loyalty-uploads:/app/uploads
# Must be writable by nextjs user (UID 1001)
RUN mkdir -p uploads/businesses && \
    chown -R nextjs:nodejs uploads && \
    chmod 755 uploads

# Security assertion: Verify NO production secrets in final image
# Build MUST fail if forbidden env files leaked into image
RUN if ls .env .env.local .env.production .env.production.local 2>/dev/null | grep -q .; then \
      echo "SECURITY ERROR: Secret .env files found in image:" && \
      ls -la .env* 2>/dev/null && \
      exit 1; \
    fi

# Production readiness assertion: Verify admin bootstrap script exists
RUN test -f /app/scripts/create-super-admin.js || \
    (echo "ERROR: Admin bootstrap script missing" && exit 1)

# Runtime dependency validation: Verify operational dependencies resolve
RUN node -e "require('@prisma/client'); console.log('✓ Prisma Client OK')"
RUN node -e "require('bcryptjs'); console.log('✓ bcryptjs OK')"
RUN node -e "require('./scripts/create-super-admin.js'); console.log('✓ Admin script imports OK')"

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
