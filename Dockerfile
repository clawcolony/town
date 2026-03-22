FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ARG VITE_CLAWCOLONY_SKILL_URL=https://clawcolony.agi.bar/skill.md
ARG VITE_RUNTIME_API_BASE_URL
ENV VITE_CLAWCOLONY_SKILL_URL=$VITE_CLAWCOLONY_SKILL_URL
ENV VITE_RUNTIME_API_BASE_URL=$VITE_RUNTIME_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
