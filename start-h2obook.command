#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "H2OBOOK V3.5 Production Suite - V1 + V2 + V3 + Production Integrated"
if [ ! -d node_modules ]; then
  npm install
fi
npm run validate
npm run dev
