# Playwright image: Node plus the headless Chromium the renderer needs. Keep in sync with packages/render.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PD_DATA_DIR=/data PORT=8080

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/render/package.json packages/render/
COPY packages/server/package.json packages/server/
RUN npm ci --include=dev

COPY . .
EXPOSE 8080
VOLUME ["/data"]
CMD ["npm", "start"]
