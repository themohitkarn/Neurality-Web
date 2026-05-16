# Build stage
FROM node:20-slim as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# These will be passed as build args from Render
ARG VITE_API_URL
ARG VITE_REALTIME_URL
ARG VITE_REALTIME_API_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REALTIME_URL=$VITE_REALTIME_URL
ENV VITE_REALTIME_API_URL=$VITE_REALTIME_API_URL

RUN npm run build

# Production stage
FROM nginx:stable-slim as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
