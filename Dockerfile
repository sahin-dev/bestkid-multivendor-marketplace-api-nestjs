# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache openssl \
    && corepack enable \
    && corepack prepare pnpm@10 --activate

# Keeps the dev dependencies, because the Prisma CLI that runs migrations is one.
# docker-compose uses this stage for its one-shot migrate service.
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate \
    && pnpm run build

FROM build AS production-dependencies
RUN pnpm prune --prod

FROM node:24-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache openssl

ENV NODE_ENV=production \
    PORT=3000

COPY --from=production-dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/generated ./generated
COPY --from=build /usr/src/app/dist ./dist

RUN mkdir -p uploads logs && chown -R node:node uploads logs
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/src/main.js"]
