#!/bin/sh
# Railway sets $PORT dynamically - nginx must listen on it
PORT="${PORT:-80}"
sed -i "s/listen 80;/listen ${PORT};/" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
