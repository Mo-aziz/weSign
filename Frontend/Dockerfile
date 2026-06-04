# Build React app with production Railway URLs, then serve static files.
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite loads .env.production when NODE_ENV=production / --mode production
RUN npm run build:prod

# ── Static server (SPA) ───────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve@14.2.4

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
