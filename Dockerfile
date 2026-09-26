# Multi-stage production build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency specifications
COPY package.json tsconfig.json vitest.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile=false

# Copy source code and tests
COPY src ./src
COPY tests ./tests

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

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package info and install only production dependencies
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile=false

# Copy compiled dist
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations

# Expose API port
EXPOSE 3000

# Default to running both API and worker
CMD ["node", "dist/index.js"]
