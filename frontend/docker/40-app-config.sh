#!/bin/sh
# Runs at container start (nginx image executes /docker-entrypoint.d/*.sh).
# Writes the backend URL into config.js so it can be changed with an env var, no rebuild.
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
# A URL never contains quotes or backslashes; drop them so the JS string literal stays valid.
SAFE_URL=$(printf '%s' "$API_BASE_URL" | tr -d '"\')

printf 'window.__APP_CONFIG__ = { apiBaseUrl: "%s" };\n' "$SAFE_URL" > /usr/share/nginx/html/config.js

echo "app-config: API_BASE_URL=${SAFE_URL}"
