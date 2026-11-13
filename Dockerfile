FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir /app/data && chown node:node /app/data
COPY client ./client
COPY server ./server
USER node
ENV PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["npm", "start"]
