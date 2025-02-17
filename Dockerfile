FROM ubuntu:latest

EXPOSE 2536 2877

# Install dependencies
RUN apt update && apt install -y \
    libasound2t64 \
    libglib2.0-0t64 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libxrandr2 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0t64 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxss1 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    lsb-release \
    xdg-utils \
    wget \
    git \
    curl \
    redis

WORKDIR /root

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    . ~/.bashrc && \
    nvm install 23.3.0 && \
    nvm use 23.3.0 && \
    npm config set registry https://registry.npmmirror.com && \
    npm i -g pnpm

# 或者本地COPY
RUN echo '#!/bin/sh' > /root/start.sh && \
    echo '. ~/.bashrc' >> /root/start.sh && \
    echo 'if [ ! -d "/root/Yunzai" ]; then' >> /root/start.sh && \
    echo '  git clone https://gitee.com/juhkff/Yunzai.git /root/Yunzai' >> /root/start.sh && \
    echo '  cd /root/Yunzai' >> /root/start.sh && \
    echo 'else' >> /root/start.sh && \
    echo '  cd /root/Yunzai && git restore . && git pull' >> /root/start.sh && \
    echo 'fi' >> /root/start.sh && \
    echo 'pnpm i && pnpm puppeteer browsers install chrome' >> /root/start.sh && \
    echo 'node .' >> /root/start.sh && \
    chmod +x /root/start.sh

ENTRYPOINT ["/root/start.sh"]
