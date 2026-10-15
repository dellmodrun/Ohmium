FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY . .
RUN node tools/build-source-index.mjs && mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=4210 OHMIUM_DATA_DIR=/app/data
EXPOSE 4210
VOLUME ["/app/data"]
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:4210/api/health || exit 1
CMD ["node", "server.mjs"]
