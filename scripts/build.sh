#!/usr/bin/env bash
# Builds the whole toolkit into ./dist as one deployable static site:
#   dist/                -> hub landing page
#   dist/shell/           -> shared navbar/theme assets
#   dist/noise-monitor/   -> built React/Vite app
#   dist/quick-poll/, dist/random-picker/, dist/visual-timer/ -> static tools
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

# Shared shell assets
cp -r packages/shell dist/shell

# Hub landing page
cp -r apps/hub/. dist/

# Static single-file tools
for tool in quick-poll random-picker visual-timer research; do
  mkdir -p "dist/$tool"
  cp "apps/$tool/index.html" "dist/$tool/index.html"
done

# React/Vite noise-monitor app
npm run build --workspace apps/noise-monitor
mkdir -p dist/noise-monitor
cp -r apps/noise-monitor/dist/. dist/noise-monitor/

echo "Built site into ./dist"
