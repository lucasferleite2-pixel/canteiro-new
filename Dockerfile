FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_SUPABASE_URL=https://dipppunawemcsdokkpal.supabase.co
ENV VITE_SUPABASE_PROJECT_ID=dipppunawemcsdokkpal
ENV VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcHBwdW5hd2VtY3Nkb2trcGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTcyODgsImV4cCI6MjA5MDIzMzI4OH0._sJ1W9W4pit55mpVJ8T7bMF70QVFn5F2ATpS39Io33c
RUN npm run build

FROM caddy:2-alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
