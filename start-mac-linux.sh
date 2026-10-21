#!/usr/bin/env sh
set -e
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Get it from https://nodejs.org"
  exit 1
fi
printf 'Starting FOUR CROWNS at http://localhost:3000\n'
node server.js
