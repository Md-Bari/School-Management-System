#!/bin/sh
# Runs at container start (nginx image executes /docker-entrypoint.d/*.sh).
# Writes the backend URL into config.js so it can be changed with an env var, no rebuild.
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
# Escape characters that would break the JS string literal.
ESCAPED=$(printf '%s' "$API_BASE_URL" | sed 's/\/\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = { apiBaseUrl: "${ESCAPED}" };
CONFIG

echo "app-config: API_BASE_URL=${API_BASE_URL}"
