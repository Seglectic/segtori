FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src

EXPOSE 8020

CMD ["npm", "start"]
