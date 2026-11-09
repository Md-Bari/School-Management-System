# ---- dependencies & build ---------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- tests (docker compose --profile test run --rm frontend-tests) -----
FROM build AS test
CMD ["npm", "test"]

# ---- runtime (default target) --------------------------------------------
FROM nginx:1.27-alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
# Guard against CRLF line endings when the repo is checked out on Windows.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-app-config.sh \
    && chmod +x /docker-entrypoint.d/40-app-config.sh
ENV API_BASE_URL=http://localhost:8080
EXPOSE 80
