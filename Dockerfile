# ── Stage 1: Build the Node.js CORS proxy ─────────────────────────
FROM node:20-alpine AS proxy-build
WORKDIR /app/proxy
COPY proxy/package.json .
RUN npm install --omit=dev
COPY proxy/ .

# ── Stage 2: Build the Node.js database API ───────────────────────
FROM node:20-alpine AS api-build
WORKDIR /app/api
COPY api/package.json .
RUN npm install --omit=dev
COPY api/ .

# ── Stage 3: Final image (nginx + Node.js) ────────────────────────
FROM nginx:alpine

# Node.js is needed to run both backend servers
RUN apk add --no-cache nodejs

# Copy CORS proxy
COPY --from=proxy-build /app/proxy /app/proxy
RUN chmod -R 755 /app/proxy

# Copy database API
COPY --from=api-build /app/api /app/api
RUN chmod -R 755 /app/api

# Copy frontend static files
COPY index.html        /usr/share/nginx/html/
COPY experiment.html   /usr/share/nginx/html/
COPY test-proxy.html   /usr/share/nginx/html/
COPY css/              /usr/share/nginx/html/css/
COPY js/               /usr/share/nginx/html/js/
COPY adapters/         /usr/share/nginx/html/adapters/
RUN chmod -R 755 /usr/share/nginx/html

# nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
