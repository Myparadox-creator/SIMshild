# Multi-stage production Dockerfile for SIMShield Risk Service
FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src/ ./src/
COPY db/ ./db/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["node", "src/server.mjs"]
