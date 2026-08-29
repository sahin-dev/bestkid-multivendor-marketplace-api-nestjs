# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /usr/src/app

RUN apk add --no-cache openssl bash

FROM base AS dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install --include=dev

FROM dependencies AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000

RUN apk add --no-cache openssl bash

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install --omit=dev --no-fund --no-audit

COPY --from=build /usr/src/app/generated ./generated
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/src ./src
COPY --from=build /usr/src/app/uploads ./uploads
COPY --from=build /usr/src/app/views ./views

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
