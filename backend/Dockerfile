# Backend Dockerfile
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=30 CMD node -e "require('http').get('http://localhost:4000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
