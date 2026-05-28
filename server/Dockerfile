FROM node:24-bookworm-slim

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com/ && \
    yarn config set registry https://registry.npmmirror.com/

COPY . .

RUN yarn install --frozen-lockfile && \
    yarn build && \
    yarn cache clean

ENV NODE_ENV=prod
ENV PORT=10588

EXPOSE 10588

CMD ["node", "data/serve/app.js"]
