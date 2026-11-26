# --- Étape 1 : compilation TypeScript -> JavaScript ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts : aucun script postinstall n'est nécessaire pour compiler.
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Étape 2 : image finale, uniquement le nécessaire pour tourner ---
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY public ./public
# Ne pas tourner en root dans le conteneur.
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
