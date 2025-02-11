# TRSS-Yunzai

自用群 BOT

# 配置

```console
nvm install 23.3.0
nvm use 23.3.0
npm config set registry https://registry.npmmirror.com
npm i -g pnpm
cd Yunzai
pnpm i
```

# docker 下载和安装

```console
docker pull juhkff/qq-bot:latest

<!-- 私人仓库，不提供密钥 -->

docker run -d -p 2536:2536 -p 2877:2877 --name qq-bot -e GITEE_TOKEN=GITEE密钥 juhkff/qq-bot:latest
```

# docker 清理容器日志

```console
rm /var/lib/docker/containers/<containerId>/<containerId>-json.log
```
