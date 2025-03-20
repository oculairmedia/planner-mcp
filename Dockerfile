FROM docker.io/node:20-slim

# Set working directory
WORKDIR /app

# Add metadata labels
LABEL maintainer="OpenHands"
LABEL description="Planner MCP Server with SSE transport"
LABEL version="1.0.0"

# Copy package files and install dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code and configuration files
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle ./drizzle

# Build TypeScript code
RUN pnpm run build

# Create a non-root user and switch to it
RUN groupadd -r planner && useradd -r -g planner planner
RUN chown -R planner:planner /app
USER planner

# Expose the port
EXPOSE 54398

# Default environment variables (can be overridden at build or runtime)
ARG PORT=54398
ARG NODE_ENV=production
ENV PORT=${PORT}
ENV NODE_ENV=${NODE_ENV}

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the server
CMD ["node", "dist/index.sse.js"]