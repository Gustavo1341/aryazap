# Use a imagem base Node.js slim
FROM node:23-slim

# Instale APENAS as dependências de sistema necessárias para o Puppeteer/Chromium rodar
# (Exemplo para Debian/Ubuntu based - ajuste se necessário para Alpine/outras)
# REMOVIDO: chromium
RUN apt-get update && apt-get install -yq --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --fix-missing \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Defina o diretório de trabalho
WORKDIR /usr/src/app

# Copie os arquivos de dependência
COPY package*.json ./

# Instale as dependências - O Puppeteer deve baixar o Chromium aqui
# Certifique-se que whatsapp-web.js está em 'dependencies' no package.json
RUN npm ci --omit=dev
# Ou use 'npm install --production' se preferir

# Copie o restante do código da aplicação
COPY . .

# (Opcional) Exponha a porta se necessário (ex: para API)
# EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "node", "main.js" ]