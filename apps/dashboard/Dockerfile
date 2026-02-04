# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/homepage/package.json apps/homepage/

RUN npm ci --workspace=apps/dashboard

# Copy Dashboard source
COPY apps/dashboard/ apps/dashboard/

# Build Next.js (standalone output)
RUN npm run build --workspace=apps/dashboard

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/dashboard/server.js"]
