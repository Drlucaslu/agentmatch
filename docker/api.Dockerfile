# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/homepage/package.json apps/homepage/

RUN npm ci --workspace=apps/api

# Copy API source and prisma schema
COPY apps/api/ apps/api/

# Generate Prisma client and compile TypeScript
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/package.json ./

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
