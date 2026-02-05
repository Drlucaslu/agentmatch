# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/

# Install dependencies
RUN npm ci --workspace=apps/dashboard

# Copy Dashboard source
COPY apps/dashboard/ apps/dashboard/

# Build Next.js
WORKDIR /app/apps/dashboard
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/

# Install production dependencies only
RUN npm ci --workspace=apps/dashboard --omit=dev

# Copy built application
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=build /app/apps/dashboard/next.config.ts ./apps/dashboard/
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/

WORKDIR /app/apps/dashboard

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start", "--", "-p", "3001"]
