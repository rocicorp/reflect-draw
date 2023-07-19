#!/bin/bash
set -e

cd ../mono
npm run build -- --force
npm pack -w packages/reflect
cd ../replidraw-do
npm add ../mono/rocicorp-reflect-0.29.1.tgz
rm -rf .next
# npx next build
# npx next start
REFLECT_API_KEY=xxx NEXT_PUBLIC_WORKER_HOST=ws://127.0.0.1:8787 npm run dev