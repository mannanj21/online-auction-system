FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app /app

EXPOSE 3000
CMD ["npm", "start"]
