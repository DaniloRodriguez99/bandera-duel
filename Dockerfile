FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json

RUN npm ci --include=dev

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server

RUN npm run build:server
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/package.json packages/server/package.json
COPY --from=build /app/packages/server/dist packages/server/dist

EXPOSE 8080

# Node itself must be PID 1's child that receives SIGTERM: through `npm start` the signal reaches
# npm first, and the world's save-on-shutdown may never run before Cloud Run kills the container.
# Same working directory `npm start -w @bandera/server` would use.
WORKDIR /app/packages/server
CMD ["node", "dist/index.js"]
