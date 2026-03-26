FROM node:20-alpine
WORKDIR /app
# Create a dummy package.json since we use native http
RUN echo '{"name":"local-api","version":"1.0.0","dependencies":{}}' > package.json
COPY . .
EXPOSE 3003
CMD ["node", "server.js"]
