#!/usr/bin/env bash
# Chứng minh kiến trúc §6d: Go HOST (edge) + Node SSR WORKER phía sau.
# Go phục vụ endpoint manifest-native (healthz/sitemap/robots) + proxy SSR xuống Node.
set -euo pipefail
cd "$(dirname "$0")"

NODE_PORT=5180
HOST_PORT=8090
pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

echo "▸ resolve dev + prerender static + build client"
npm run resolve -- dev >/dev/null 2>&1
npx tsx scripts/prerender.ts dev >/dev/null 2>&1
npm run build:client >/dev/null 2>&1

echo "▸ start Node SSR tier :$NODE_PORT (worker — render React)"
PORT=$NODE_PORT npx tsx src/server.tsx >/tmp/fluxe-node.log 2>&1 & pids+=($!)

echo "▸ start Go host :$HOST_PORT (edge → proxy Node)"
( cd app/native/host-go && PORT=$HOST_PORT FLUXE_UPSTREAM=http://127.0.0.1:$NODE_PORT FLUXE_MANIFEST=../../.fluxe/resolution.json FLUXE_STATIC=../../.fluxe/static.json go run . ) >/tmp/fluxe-host.log 2>&1 & pids+=($!)

echo "▸ chờ Go host sẵn sàng…"
for i in $(seq 1 60); do curl -fsS "http://127.0.0.1:$HOST_PORT/healthz" >/dev/null 2>&1 && break; sleep 0.2; done

H="http://127.0.0.1:$HOST_PORT"
echo
echo "════════ PROOF: mọi request đi qua Go host (:$HOST_PORT) ════════"
echo "[healthz] — Go phục vụ native:"
echo "  $(curl -s $H/healthz)"
echo "[sitemap.xml] — Go phục vụ native (header + loc):"
echo "  header: $(curl -s -D - $H/sitemap.xml -o /dev/null | grep -i 'x-fluxe-host' | tr -d '\r')"
curl -s $H/sitemap.xml | grep -o "<loc>[^<]*</loc>" | sed 's/^/  /'
echo "[/ (home static)] — Go phục vụ PRERENDERED trực tiếp (KHÔNG chạm Node):"
echo "  render header: $(curl -s -D - $H/ -o /dev/null | grep -i 'x-fluxe-render' | tr -d '\r')"
echo "  có nội dung home? $(curl -s $H/ | grep -oc 'fullstack tối giản')"
echo "[/todos] — SSR React do Node render, qua Go host (island, KHÔNG prerender):"
echo "  có <ul> SSR? $(curl -s $H/todos | grep -oc '<ul')   render header: $(curl -s -D - $H/todos -o /dev/null | grep -i 'x-fluxe-render' | tr -d '\r')(rỗng=proxy Node)"
echo "[/todos?json=1] — API qua proxy:"
echo "  $(curl -s "$H/todos?json=1" | head -c 130)…"
echo
echo "→ Go là CỬA TRƯỚC (edge + manifest-native); Node là SSR WORKER phía sau. Đúng §6d."
