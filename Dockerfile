FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
# Generate Prisma client
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
# Copy Prisma schema and migrations for runtime migrations
COPY --from=build-env /app/prisma /app/prisma
COPY --from=build-env /app/prisma.config.ts /app/prisma.config.ts
# Copy generated Prisma client
COPY --from=build-env /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build-env /app/node_modules/@prisma /app/node_modules/@prisma
WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /app/prisma

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/prisma/prod.db"

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]