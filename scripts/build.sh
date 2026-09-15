#!/usr/bin/env bash
# Builds the whole toolkit into ./dist as one deployable static site:
#   dist/                -> hub landing page
#   dist/shell/           -> shared navbar/theme assets
#   dist/noise-monitor/   -> built React/Vite app
#   dist/<tool>/          -> every other tool, copied wholesale (no build step)
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

# Shared shell assets
cp -r packages/shell dist/shell

# Hub landing page
cp -r apps/hub/. dist/

# Static tools (single- or multi-file: HTML pages + any shared per-tool JS).
# Each just needs its whole apps/<tool>/ directory copied as-is.
for tool in quick-poll random-picker visual-timer research zones \
            exit-ticket group-generator behaviour-tracker restorative-circle \
            growth-mindset kagan-timer choice-board presentation-timer \
            assessment-checklist snowball-wall question-builder challenge-deck \
            think-time rotation-timer chili-challenge help-ladder \
            coin-flip break-timer board \
            homework-menu behaviour-reflection; do
  mkdir -p "dist/$tool"
  cp -r "apps/$tool/." "dist/$tool/"
done

# React/Vite noise-monitor app
npm run build --workspace apps/noise-monitor
mkdir -p dist/noise-monitor
cp -r apps/noise-monitor/dist/. dist/noise-monitor/

echo "Built site into ./dist"
