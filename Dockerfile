# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
# The build shown at the foot of the sidebar; the deploy passes them, a local build leaves them empty
ARG APP_COMMIT=
ARG APP_BUILT_AT=
ARG APP_ENV=
ENV VITE_APP_COMMIT=$APP_COMMIT     VITE_APP_BUILT_AT=$APP_BUILT_AT     VITE_APP_ENV=$APP_ENV
RUN npm run build

# Production stage — serve with nginx
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
