# Vícefázový build — výsledný image nese jen produkční závislosti a přeložený
# JavaScript, ne TypeScript zdroje ani dev nástroje.

FROM node:22-slim AS base
# Prisma potřebuje OpenSSL, slim image ho nemá.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
# Neběžet jako root — image node už uživatele `node` obsahuje.
RUN mkdir -p /data/media && chown -R node:node /data
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY package.json ./

USER node
EXPOSE 4000

# Migrace se pouští při startu — kontejner se tak sám srovná s aktuálním
# schématem a nemusí se to dělat ručně po každém deployi.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/Server.js"]
