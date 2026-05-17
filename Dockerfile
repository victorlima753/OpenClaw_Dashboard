FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma 7 resolves DATABASE_URL while loading prisma.config.ts during generate/build.
# EasyPanel injects the real database URL at runtime, so the build stage uses a
# non-routable placeholder only to generate the client.
ENV DATABASE_URL=postgresql://techsouls:techsouls@127.0.0.1:5432/techsouls_command_center?schema=public
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN DATABASE_URL=postgresql://techsouls:techsouls@127.0.0.1:5432/techsouls_command_center?schema=public npm ci --omit=dev
RUN DATABASE_URL=postgresql://techsouls:techsouls@127.0.0.1:5432/techsouls_command_center?schema=public npm run prisma:generate
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
