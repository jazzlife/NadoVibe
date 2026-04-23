FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps

RUN npm ci && npm run typecheck

CMD ["node", "services/core-control-plane/dist/server.js"]
