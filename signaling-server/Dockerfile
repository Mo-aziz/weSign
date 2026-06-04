FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SIGNALING_USE_HTTP=true

EXPOSE 3001

CMD ["node", "server.js"]
