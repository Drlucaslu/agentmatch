# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/homepage/package.json apps/homepage/

# Install dependencies
RUN npm ci --workspace=apps/homepage

# Copy Homepage source
COPY apps/homepage/ apps/homepage/

# Build Next.js
WORKDIR /app/apps/homepage
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package.json package-lock.json ./
COPY apps/homepage/package.json apps/homepage/

# Install production dependencies only
RUN npm ci --workspace=apps/homepage --omit=dev

# Copy built application
COPY --from=build /app/apps/homepage/.next ./apps/homepage/.next
COPY --from=build /app/apps/homepage/public ./apps/homepage/public
COPY --from=build /app/apps/homepage/next.config.ts ./apps/homepage/
COPY --from=build /app/apps/homepage/package.json ./apps/homepage/

WORKDIR /app/apps/homepage

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start", "--", "-p", "3002"]
