FROM node:20-alpine

WORKDIR /app

# Installe les dépendances
COPY package.json ./
RUN npm install --production

# Copie le reste du code
COPY . .

# Expose le port (Sliplane utilise PORT env var)
EXPOSE 3000

CMD ["node", "server.js"]
