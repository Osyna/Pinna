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

# Create nginx pid directory
RUN mkdir -p /run/nginx

EXPOSE 80

# Sync the database schema (creates tables if they don't exist), then
# start nginx and the Express server.
CMD sh -c "npx prisma db push --skip-generate && nginx && node server/index.js"
