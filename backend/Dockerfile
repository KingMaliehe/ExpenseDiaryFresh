# Multi-stage build: compile TypeScript + generate Prisma client, then ship
# a slim runtime image. Built automatically by docker compose (see deploy/).
FROM node:20-slim AS build
WORKDIR /app
# openssl is required by Prisma's engines on debian-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
# Full node_modules from build (includes generated Prisma client + prisma CLI
# for `migrate deploy` at startup). Dev deps add a little size; simplicity wins.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
