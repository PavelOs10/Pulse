FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json server/
RUN cd server && npm install --production

# Install client dependencies and build
COPY client/package.json client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npm run build

# Copy server code
COPY server/ server/

# Data directory (DB + uploads) — mount a volume here!
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["node", "server/server.js"]
