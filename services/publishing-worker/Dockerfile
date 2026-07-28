FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ghostscript fonts-noto-core fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV GHOSTSCRIPT_PATH=/usr/bin/gs
CMD ["node","index.mjs"]
