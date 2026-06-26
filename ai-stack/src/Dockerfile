# Dockerfile - the RAG service container for Azure Container Apps. Small Node
# base; installs prod deps only; runs the plain-http server on PORT (8080).
FROM node:20-slim

WORKDIR /app

# Install dependencies first for layer caching.
COPY package.json ./
RUN npm install --omit=dev

# Copy the service source.
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
