# Build frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build
RUN npx prisma generate

# Production stage
FROM node:20-alpine

RUN apk add --no-cache nginx

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy server code
COPY server ./server

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy and prepare the startup script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create nginx pid directory
RUN mkdir -p /run/nginx

EXPOSE 80

# Sync the database schema, then start nginx and the Express server.
CMD ["./docker-entrypoint.sh"]
