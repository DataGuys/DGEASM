# Build stage
FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN groupadd -r easm && useradd -r -g easm easm
USER easm

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3000/health', { method: 'GET' }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).end()"

# Command to run the application
CMD ["node", "dist/index.js"]