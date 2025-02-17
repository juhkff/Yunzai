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

docker run -d -p 2536:2536 -p 2877:2877 --name qq-bot juhkff/qq-bot:latest
```

# docker 清理容器日志

```console
rm /var/lib/docker/containers/<containerId>/<containerId>-json.log
```

# 合并和更新第三方远程仓库（开发用）

以 TRSS-Yunzai 为例，添加 TRSS-Yunzai 远程仓库并命名为 yunzai 后执行以下命令（TRSS-Yunzai 中的 main 分支为最新版）

```console
git merge --squash yunzai/main --allow-unrelated-histories
```

# ociq 文档（开发用）

[https://oicqjs.github.io/oicq/](https://oicqjs.github.io/oicq/)
