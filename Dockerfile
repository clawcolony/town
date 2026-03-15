# 使用 Node.js 官方镜像作为基础镜像
FROM uhub.service.ucloud.cn/zoooo/node:lts-alpine as build-stage

# ARG VITE_APP_API_URL
ARG BUILD_ENV

RUN echo "Build Env: $BUILD_ENV"

# 设置工作目录
WORKDIR /app

# 将 package.json 和 yarn-lock.json 添加到工作目录
COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate


# 安装项目依赖
RUN pnpm install --frozen-lockfile

# 将项目文件添加到工作目录
COPY . .

# 构建项目
ENV NODE_ENV production
RUN pnpm build --mode $BUILD_ENV

# 使用 Nginx 镜像作为基础镜像
FROM uhub.service.ucloud.cn/zoooo/nginx:stable-alpine as production-stage

# 将构建产物复制到 Nginx 服务器的服务目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx 服务器
CMD ["nginx", "-g", "daemon off;"]
