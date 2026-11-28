# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Puppeteer's postinstall downloads a glibc Chrome build. This image is Alpine (musl), so that
# binary cannot start. The production stage uses the distro Chromium instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium's own shared libraries. Without them puppeteer.launch throws and PDF export is a 500.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/main.js"]
