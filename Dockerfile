# Multi-stage production build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and pnpm pinned to v9
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# Copy dependency specifications
COPY package.json tsconfig.json vitest.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile=false

# Copy source code, tests, and public static assets
COPY src ./src
COPY tests ./tests
COPY public ./public

# Run tests to ensure build integrity
RUN pnpm run test

# Build TypeScript to Javascript
RUN pnpm run build

# ---------------------------------------------------------------------------
# Production Runtime Stage
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# Copy package info and install only production dependencies
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile=false

# Copy compiled dist, migrations, and public UI assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY src/db/migrations ./dist/db/migrations

# Expose API port
EXPOSE 3000

# Default to running both API and worker
CMD ["node", "dist/index.js"]
