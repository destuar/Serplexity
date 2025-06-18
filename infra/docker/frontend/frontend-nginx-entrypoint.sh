#!/bin/sh
# Substitute environment variables in the config template
envsubst '${VITE_API_URL},${VITE_NODE_ENV}' < /usr/share/nginx/html/config.js.template > /usr/share/nginx/html/config.js

# Execute the CMD from the Dockerfile
exec "$@" 