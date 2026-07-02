#!/usr/bin/env bash
set -euo pipefail

cd "${APP_DIR:-$HOME/discount-hunter}"

echo "== git pull =="
git pull

echo "== npm install =="
npm install

echo "== build =="
npm run build

echo "== restart pm2 =="
pm2 restart discount-hunter --update-env
pm2 save

echo "== verify =="
bash scripts/verify-all.sh
