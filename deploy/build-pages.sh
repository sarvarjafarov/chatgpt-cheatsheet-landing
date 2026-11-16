#!/bin/sh
# Cloudflare Pages build step: publish only the public files into dist/.
# Pages settings: Build command "sh deploy/build-pages.sh", output directory "dist".
set -e
rm -rf dist
mkdir -p dist
cp index.html og-image.png _headers dist/
echo "Built dist/: $(ls dist | tr '\n' ' ')"
