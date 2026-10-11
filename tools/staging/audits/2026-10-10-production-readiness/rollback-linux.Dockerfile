# Reviewed local rollback artifact. No credentials, seed or migration at build/start.
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY prisma ./prisma
COPY tests ./tests
COPY tsconfig.json ./
RUN node node_modules/prisma/build/index.js generate && node node_modules/typescript/bin/tsc && node tests/run-tests.cjs
FROM build AS qualification
CMD ["node", "tests/run-tests.cjs"]
FROM build AS production-deps
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM base AS runtime
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
USER node
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
