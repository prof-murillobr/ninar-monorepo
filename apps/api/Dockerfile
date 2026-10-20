FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
RUN pnpm config set minimum-release-age 0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
RUN pnpm config set minimum-release-age 0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
