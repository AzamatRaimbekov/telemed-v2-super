#!/bin/sh
# Substitute environment variables in nginx config
export PORT=${PORT:-80}
export BACKEND_PORT=${BACKEND_PORT:-8000}
envsubst '${PORT} ${BACKEND_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
