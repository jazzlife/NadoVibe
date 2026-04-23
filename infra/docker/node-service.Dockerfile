FROM node:22-alpine

WORKDIR /app

ARG NADOVIBE_BUILD_VERSION=0.1.0
ARG NADOVIBE_GIT_SHA=local
ARG NADOVIBE_IMAGE_TAG=local

LABEL com.nadovibe.platform.version="${NADOVIBE_BUILD_VERSION}" \
  com.nadovibe.git.sha="${NADOVIBE_GIT_SHA}" \
  com.nadovibe.image.tag="${NADOVIBE_IMAGE_TAG}"

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps

RUN npm ci && npm run typecheck

CMD ["node", "services/core-control-plane/dist/server.js"]
