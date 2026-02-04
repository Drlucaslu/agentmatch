# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/homepage/package.json apps/homepage/

RUN npm ci --workspace=apps/homepage

# Copy Homepage source and public dir (skill.md, heartbeat.md)
COPY apps/homepage/ apps/homepage/
COPY public/ public/

# Build Next.js (standalone output)
RUN npm run build --workspace=apps/homepage

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/apps/homepage/.next/standalone ./
COPY --from=build /app/apps/homepage/.next/static ./apps/homepage/.next/static
COPY --from=build /app/public ./public

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/homepage/server.js"]
