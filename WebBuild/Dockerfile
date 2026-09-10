# Build kontext je KOŘEN repozitáře, ne WebBuild/ — web závisí na Shared/,
# takže se musí kopírovat obojí. V compose to znamená `context: ..` a
# `dockerfile: WebBuild/Dockerfile`.

FROM oven/bun:1.4-slim AS base
WORKDIR /repo

FROM base AS deps
# Nejdřív jen manifesty — vrstva se závislostmi se pak přepočítává jen když
# se opravdu změní, ne při každé úpravě kódu.
COPY package.json bun.lock ./
COPY Shared/package.json Shared/
COPY WebBuild/package.json WebBuild/
COPY TauriBuild/package.json TauriBuild/
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/Shared/node_modules ./Shared/node_modules
COPY --from=deps /repo/WebBuild/node_modules ./WebBuild/node_modules
COPY Shared ./Shared
COPY WebBuild ./WebBuild
COPY package.json bun.lock ./
# NEXT_PUBLIC_* se zapéká do klientského bundlu při buildu, ne za běhu —
# adresa API se proto musí předat sem, ne až do compose.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /repo/WebBuild
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# `standalone` si nese vlastní minimální node_modules i server.js.
# Cesty odpovídají outputFileTracingRoot = kořen repozitáře.
COPY --from=build /repo/WebBuild/.next/standalone ./
COPY --from=build /repo/WebBuild/.next/static ./WebBuild/.next/static
COPY --from=build /repo/WebBuild/public ./WebBuild/public

USER bun
EXPOSE 3000

CMD ["bun", "WebBuild/server.js"]
